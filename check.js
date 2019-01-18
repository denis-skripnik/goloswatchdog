const global = require("basescript");
const CONFIG = global.CONFIG;
const log = global.getLogger("checks");
const telegram = require("./telegram");
const memory = require("./memory");
const m = require("./messages");
const golos = require("golos-world-js");

async function checkMissed(witness, saved) {
    /// CHECK MISSED
    log.debug("\tsaved missed blocks", saved.total_missed, "prev_missed", saved.prev_missed);


    let missed =  witness.total_missed - saved.total_missed;

    if(missed) {

        const inform = async (chat) => {
            if(!chat.isWatching(witness.owner)) {return};
            let username = (chat.witness == witness.owner?" (@"+chat.username+")":"");
            let text_blocks = m.get_text_blocks(missed);
            await telegram.send(chat.chat_id, `Делегат ${witness.owner}${username} пропустил ${missed} ${text_blocks}!

help - справка по командам.

Автор бота: @gropox (ropox на Голосе),
Адаптировал для Голоса: @skripnikdenis (denis-skripnik на Голосе).`);
        }

        let chats = await memory.loadChats();
        for(let chat of chats) {
            await inform(chat);
        }
    }
    witness.prev_missed = missed;
}

async function sendVersions(chat) {
    const so = await golos.api.getWitnessScheduleAsync();
    const witnesses = await golos.api.getWitnessesByVoteAsync("", 100);

    const acc = witnesses.reduce((acc, w, i) => {
        acc.all[w.running_version] = ++acc.all[w.running_version] || 1;
        if(i < 11) {
            acc.top[w.running_version] = ++acc.top[w.running_version] || 1;
        }
        return acc;
    }, {all: {}, top: {}});


    let versions = "";
    for(let v of Object.keys(acc.all).sort((a,b) => {
        const av = a.split(".");
        const bv = b.split(".");
        for(let i = 0; i < Math.min(av.length, bv.length); i++) {
            if(av[i] !== bv[i]) {
                return parseInt(av[i]) - parseInt(bv[i]);
            }
        }
        return 0;
    })) {
        const top = (acc.top[v]?" (в тч. у топов " + acc.top[v] + ")" :"");
        versions += v + " - " + acc.all[v] + " нод " + top + "\n";
    }

    await telegram.send(chat.chat_id, `Мажоритарная версия ${so.majority_version}

${versions}`);

}


async function checkVersion(witness, saved) {
    ///CHECK VERSION
    const inform = async (chat) => {
        if(!chat.isWatching(witness.owner)) {return};
    
        let username = (chat.witness == witness.owner?" (@"+chat.username+")":"");
        await telegram.send(chat.chat_id, `Делегат ${witness.owner}${username} установил новую версию ${witness.running_version}`);

        await sendVersions(chat);
    }

    if(saved.running_version != witness.running_version) {
        let chats = await memory.loadChats();
        for(let chat of chats) {
            await inform(chat, witness);
        }
    }    
}

const EMPTY_KEY = "golos1111111111111111111111111111111114T1Anm";

async function checkSigningKey(witness, saved) {

    const inform = async (chat) => {
        if(!chat.isWatching(witness.owner)) {return};
    
        const sactive = saved.signing_key != EMPTY_KEY;
        const wactive = witness.signing_key != EMPTY_KEY;

        let username = (chat.witness == witness.owner?" (@"+chat.username+")":"");

        if(sactive && wactive) {
            await telegram.send(chat.chat_id, `Делегат ${witness.owner}${username} сменил ключ ${witness.signing_key}`);
        } else {
            if(wactive) {
                await telegram.send(chat.chat_id, `Делегат ${witness.owner}${username} был активирован! ${witness.signing_key}`);
            } else {
                await telegram.send(chat.chat_id, `Делегат ${witness.owner}${username} был деактивирован! ${witness.signing_key}`);
            }
        }
    }

    if(saved.signing_key != witness.signing_key) {
        let chats = await memory.loadChats();
        for(let chat of chats) {
            await inform(chat, witness);
        }
    }    
}

module.exports = async (witness, saved) => {
    
    await checkMissed(witness, saved);
    await checkVersion(witness, saved);
    await checkSigningKey(witness, saved);    
}