const { Client } = require('discord.js-selfbot-v13');
// const CapMonster = require('capmonster');
// const capmonster = new CapMonster('');
const { CapMonsterCloudClientFactory, ClientOptions, HCaptchaProxylessRequest } = require('@zennolab_com/capmonstercloud-client');
const cmcClient = CapMonsterCloudClientFactory.Create(new ClientOptions({ clientKey: '' }));
const { userToken, guildId, channelId, message, captcha } = require('./config.json');
const inquirer = require('inquirer');
const chalk = require('chalk');
const percentage = (partialValue, totalValue) => parseFloat((100 * partialValue) / totalValue).toPrecision(3);

const client = new Client({
    checkUpdate: false
});

const sendMessage = async (member, i, users) => {
    if (member[1].user.bot) {
        console.log(`Skipping ${chalk.bold(member[1].user.tag)} as it is a bot (${percentage(i, users)}%)`);
        return;
    };

    try {
        await client.users.cache.get(member[0])?.send(message);
        console.log(`Successfully DM-ed ${chalk.bold(member[1].user.tag)} (${percentage(i, users)}%)`);
    } catch (e) {
        if(e.message.includes("captcha-required")) {
            console.log(e.path);

            const hcaptchaProxylessRequest = new HCaptchaProxylessRequest({
                websiteURL: 'https://lessons.zennolab.com/captchas/recaptcha/v2_simple.php?level=high',
                websiteKey: e.captcha.captcha_sitekey,
            });

            const solvedCaptcha = await cmcClient.Solve(hcaptchaProxylessRequest);
            if(solvedCaptcha.error) console.log(`Cannot DM ${chalk.bold(member[1].user.tag)} - ${e.message} (${percentage(i, users)}%)`);
            if(solvedCaptcha.solution) {
                await client.users.cache.get(member[0])?.send();
            }
            console.log(solvedCaptcha);
        };

        console.log(`Cannot DM ${chalk.bold(member[1].user.tag)} - ${e.message} (${percentage(i, users)}%)`);
        if (e.httpStatus === 429) { // Rate-limited
            await client.sleep(1000);
        }
    }

    await client.sleep(20000); // Wait 15 seconds before sending the next message
}

client.on('ready', async () => {
    console.log(`Logged in ${chalk.bold(client.user.tag)}`);

    await client.guilds.fetch();

    const guild = client.guilds.cache.get(guildId);
    for (let index = 0; index <= guild.memberCount; index += 200) {
        await guild.members.fetchMemberList(channelId, index === 0 ? 100 : index, index !== 100).catch(() => {});
        console.log(`Fetched ${index} members of ${guild.memberCount} members (${percentage(index, guild.memberCount)}%)`);
        await client.sleep(500);
    }
    if (guild.members.cache.get(client.user.id)) guild.members.cache.delete(client.user.id);

    const users = guild.members.cache.size;
    
    // if (captcha) {
    //     console.log('Captcha detected. Solving captcha...');
    //     const captchaSolution = await capmonster.solveRecaptchaV2(captcha.sitekey, captcha.pageurl);
    //     console.log(`Captcha solved. Solution: ${captchaSolution}`);
    //     await client.submitCaptchaSolution(captchaSolution);
    // }

    inquirer
    .prompt([{
        name: 'start_dming',
        message: `Start DM-ing ${users} users?`,
        type: 'confirm',
        default: true
    }])
    .then(async (answers) => {
        const choice = answers['start_dming'];

        if (choice === true) {
            let i = 0;
            for (const member of guild.members.cache) {
                i++;
                await sendMessage(member, i, users);
            }
            console.log(`Finished DM-ing ${users} users! Exiting...`);
            process.exit(0);
        } else {
            console.log('Exiting...');
            process.exit(0);
        }
    });
});

client.login(userToken);