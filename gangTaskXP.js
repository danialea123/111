const { MessageEmbed, MessageAttachment } = require("discord.js");
const fs = require("fs");
const path = require("path");

const LOG_CHANNEL_ID = "1342153823732367571";
const STATUS_CHANNEL_ID = "1370728161188249600";
const DATA_FILE = "taskData.json";

let lastStatusMessage = null;

const robberyTitles = [
    { name: "◈ Fleeca XP", value: "fleeca" },
    { name: "◈ Jewelry XP", value: "javahery" },
    { name: "◈ Mythic XP", value: "mythic" },
    { name: "◈ Cargo XP", value: "cargo" },
    { name: "◈ Almas Jewelry XP", value: "almas jewelry" },
    { name: "◈ Bobcat XP", value: "bobcat" },
    { name: "◈ Mini Jewelry XP", value: "mini jewelry" },
];
const shopTitle = "shop";

function toJalaliDate(date) {
    let g_y = date.getFullYear();
    let g_m = date.getMonth() + 1;
    let g_d = date.getDate();

    const g_days_in_month = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const j_days_in_month = [31, 31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 29];

    function div(a, b) {
        return ~~(a / b);
    }

    let gy = g_y - 1600;
    let gm = g_m - 1;
    let gd = g_d - 1;

    let g_day_no = 365 * gy + div((gy + 3), 4) - div((gy + 99), 100) + div((gy + 399), 400);
    for (let i = 0; i < gm; ++i) g_day_no += g_days_in_month[i];
    if (gm > 1 && ((gy + 1600) % 4 === 0 && ((gy + 1600) % 100 !== 0 || (gy + 1600) % 400 === 0))) ++g_day_no;
    g_day_no += gd;

    let j_day_no = g_day_no - 79;
    let j_np = div(j_day_no, 12053);
    j_day_no = j_day_no % 12053;

    let jy = 979 + 33 * j_np + 4 * div(j_day_no, 1461);
    j_day_no %= 1461;

    if (j_day_no >= 366) {
        jy += div((j_day_no - 1), 365);
        j_day_no = (j_day_no - 1) % 365;
    }

    let jm, jd;
    let i = 0;
    for (; i < 11 && j_day_no >= j_days_in_month[i]; ++i) j_day_no -= j_days_in_month[i];
    jm = i + 1;
    jd = j_day_no + 1;

    return `${jy}/${jm.toString().padStart(2, '0')}/${jd.toString().padStart(2, '0')}`;
}

function resetDailyTasks() {
    const now = new Date();
    const iranOffset = 3.5 * 60 * 60 * 1000;
    const utcNow = now.getTime() + now.getTimezoneOffset() * 60000;
    const iranNow = new Date(utcNow + iranOffset);

    const resetHour = 7;
    const resetMinute = 0;
    const todayResetTime = new Date(iranNow.getFullYear(), iranNow.getMonth(), iranNow.getDate(), resetHour, resetMinute).getTime();

    let savedData = {};
    if (fs.existsSync(DATA_FILE)) {
        savedData = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
        if (savedData.date === todayResetTime) return;
    }

    if (fs.existsSync(DATA_FILE)) {
        fs.unlinkSync(DATA_FILE);
    }

    savedData = {
        date: todayResetTime,
        gangTask: {
            first: "<:disable:1347960754594119833> `No one complete gang tasks`",
            second: "<:disable:1347960754594119833> `No one complete gang tasks`"
        },
        drugTaskLogs: [],
        robberyTasks: {}
    };

    fs.writeFileSync(DATA_FILE, JSON.stringify(savedData, null, 2));
}

function loadTaskData() {
    if (!fs.existsSync(DATA_FILE)) resetDailyTasks();
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function saveTaskData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

module.exports = async (client) => {
    async function updateGangTaskStatus() {
        try {
            const taskData = loadTaskData();
            const logChannel = await client.channels.fetch(LOG_CHANNEL_ID);
            if (!logChannel?.isText()) return;

            const messages = await logChannel.messages.fetch({ limit: 100 });
            const now = new Date();
            const iranOffset = 3.5 * 60 * 60 * 1000;
            const utcNow = now.getTime() + now.getTimezoneOffset() * 60000;
            const iranNow = new Date(utcNow + iranOffset);

            const today7am = new Date(iranNow.getFullYear(), iranNow.getMonth(), iranNow.getDate(), 7);
            const start = iranNow >= today7am ? today7am : new Date(today7am.getTime() - 3.5 * 60 * 60 * 1000);
            const end = new Date(start.getTime() + 3.5 * 60 * 60 * 1000);

            let shopEntries = {};
            let shopXP = 0, robberyXP = 0, drugXP = 0, gangXP = 0;

            taskData.drugTaskLogs = [];
            for (const key of Object.keys(taskData.robberyTasks)) taskData.robberyTasks[key] = [];

            messages.forEach((message) => {
                const msgTime = new Date(message.createdTimestamp);
                if (msgTime < start || msgTime >= end) return;

                const timestamp = `<t:${Math.floor(message.createdTimestamp / 1000)}:R>`;
                if (message.embeds.length === 0) return;
                const embed = message.embeds[0];

                let content = embed.description || "";
                if (embed.fields) {
                    for (const field of embed.fields) content += ` ${field.value}`;
                }

                const playerMatch = content.match(/Esm IC Player\s*:\s*(.+)/);
                const playerName = playerMatch ? playerMatch[1].trim().replace(/_/g, " ") : null;

                const xpMatch = content.match(/Meghdar:\s*(\d+)/);
                const xp = xpMatch ? parseInt(xpMatch[1], 10) : 0;

                if (content.includes("Gang Task XP") && playerName) {
                    const taskHour = msgTime.getHours();
                    gangXP += xp;

                    if (taskHour >= 7 && taskHour < 18 && taskData.gangTask.first.includes("No one")) {
                        taskData.gangTask.first = `<:enable:1347960489400864858> \`${playerName}\` ${timestamp}`;
                    } else if (taskHour >= 18 && taskData.gangTask.second.includes("No one")) {
                        taskData.gangTask.second = `<:enable:1347960489400864858> \`${playerName}\` ${timestamp}`;
                    }
                }

                if (content.includes("Drug Task XP") && playerName) {
                    drugXP += xp;

                    taskData.drugTaskLogs.push({ name: playerName, time: timestamp, xp });

                    fs.writeFileSync('taskData.json', JSON.stringify(taskData, null, 2));
                }

                const robberyMatch = content.match(/XP Model\s*:\s*(.+?)\s*XP/);
                if (robberyMatch && playerName) {
                    const robberyType = robberyMatch[1].toLowerCase();
                    if (robberyType.includes(shopTitle)) {
                        shopEntries[playerName] = (shopEntries[playerName] || 0) + 1;
                        shopXP += xp;
                    } else {
                        const match = robberyTitles.find(r => r.value === robberyType);
                        if (match) {
                            if (!Array.isArray(taskData.robberyTasks[match.value])) {
                                taskData.robberyTasks[match.value] = [];
                            }
                            robberyXP += xp;
                            const entry = `- \`${playerName}\` ${timestamp} • XP: \`(${xp})\``;
                            if (!taskData.robberyTasks[match.value].includes(entry)) {
                                taskData.robberyTasks[match.value].push(entry);
                            }
                        }
                    }
                }
            });

            const shopTaskDescription = Object.entries(shopEntries)
                .sort((a, b) => b[1] - a[1])
                .map(([name, count]) => `- \`${name}\` **( ${count} )**`)
                .join("\n") || "<:disable:1347960754594119833> \`No shop robbery have been completed\`";

            const robberyTaskDescription = robberyTitles.map(({ name, value }) => {
                const entries = taskData.robberyTasks[value];
                return entries && entries.length ? `**${name}**\n${entries.join("\n")}` : null;
            }).filter(Boolean).join("\n\n") || "<:disable:1347960754594119833> \`No big robbery have been completed\`";

            const drugTaskText = taskData.drugTaskLogs.length
                ? taskData.drugTaskLogs.map(({ name, time }) => `- \`${name}\` ${time}`).join("\n")
                : "<:disable:1347960754594119833> \`No drug tasks have been completed\`";

            const jDate = toJalaliDate(new Date());
            const thumbnailPath = path.join(__dirname, "./assets", "Low-Gif.gif");
            const thumbnailAttachment = new MessageAttachment(thumbnailPath);

            const bothGangDone = !taskData.gangTask.first.includes("No one") && !taskData.gangTask.second.includes("No one");
            const robberyTaskDone = Object.values(taskData.robberyTasks).some(entries => entries && entries.length);
            const shopTaskDone = Object.keys(shopEntries).length > 0;
            const drugTaskDone = taskData.drugTaskLogs.length >= 5;

            const gangSymbol = bothGangDone ? "+" : "-";
            const robberySymbol = robberyTaskDone ? "+" : "-";
            const shopSymbol = shopTaskDone ? "+" : "-";
            const drugSymbol = drugTaskDone ? "+" : "-";

            const gangTaskCompleted = [taskData.gangTask.first, taskData.gangTask.second].filter(task => !task.includes("No one")).length;
            const totalXP = gangXP + drugXP + robberyXP + shopXP;

            taskData.totalXP = totalXP;
            saveTaskData(taskData);

            const embed = new MessageEmbed()
                .setTitle(`◈ Daily Task Report \`${jDate}\``)
                .setColor("#020202")
                .setDescription(`
\`\`\`diff
${gangSymbol} Gang Task (${gangTaskCompleted}/2) - (XP: ${gangXP}) 
\`\`\`
**🥇 Gang Task:** ${taskData.gangTask.first}
**🥈 Gang Task:** ${taskData.gangTask.second}

\`\`\`diff
${drugSymbol} Drug Task (${taskData.drugTaskLogs.length}/5) - (XP: ${drugXP}) 
\`\`\`
${drugTaskText}

\`\`\`diff
${robberySymbol} Big Robbery - (XP: ${robberyXP}) 
\`\`\`
${robberyTaskDescription}

\`\`\`diff
${shopSymbol} Shop Robbery - (XP: ${shopXP}) 
\`\`\`
${shopTaskDescription}

\`\`\`CSS
• Today Total XP: ${totalXP} 
\`\`\`
`)
                .setThumbnail("attachment://Low-Gif.gif")
                .setFooter({ text: "DΔRK High Command Team", iconURL: "https://imgurl.ir/uploads/g73713_dark-ezgif_com-webp-to-png-converter.png" })
                .setTimestamp();

            const statusChannel = await client.channels.fetch(STATUS_CHANNEL_ID);
            if (!statusChannel?.isText()) return;

            const recentMessages = await statusChannel.messages.fetch({ limit: 10 });
            const lastStatusMessage = recentMessages.find(msg =>
                msg.author.id === client.user.id &&
                msg.embeds[0]?.title?.startsWith("◈ Daily Task Report")
            );

            if (lastStatusMessage) {
                await lastStatusMessage.edit({ embeds: [embed], files: [thumbnailAttachment] });
            } else {
                await statusChannel.send({ embeds: [embed], files: [thumbnailAttachment] });
            }

        } catch (err) {
            console.error("❌ Error Check:", err);
        }
    }

    updateGangTaskStatus();
    setInterval(updateGangTaskStatus, 10 * 1000);
};