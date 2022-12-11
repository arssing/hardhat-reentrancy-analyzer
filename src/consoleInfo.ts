/**
 * Based on solidity-coverage/lib/ui.js
 */
import chalk from "chalk";
import * as emoji from "node-emoji";

class ConsoleInfo{
    log: typeof console.log;
    chalk: typeof chalk;

    constructor(){
        this.log = console.log;
        this.chalk = chalk;
    }

    info(msg: string){
        this.log(this._addEmoji(msg));
    }

    red(msg: string){
        this.log(this.chalk.red(this._addEmoji(msg)));
    }

    green(msg: string){
        this.log(this.chalk.green(this._addEmoji(msg)));
    }

    _addEmoji(msg: string){
        return emoji.emojify(msg);
    }
}

export default ConsoleInfo;