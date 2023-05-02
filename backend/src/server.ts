import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import fs from 'fs';
const os = require("os");
const pty = require("node-pty");
const OpenAI = require('openai-api');

const { exec } = require('child_process'); 
const shell = os.platform() === "win32" ? "powershell.exe" : "bash";
const openai = new OpenAI('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');

const io = require('socket.io')(3000, {
    cors: {
        credentials: true,
        origin: ['http://localhost:4200']
    }
})

let i = 0;
const app = express();

app.use(bodyParser.json());

app.use(bodyParser.urlencoded({
    extended:true
}))

let ptyProcess = pty.spawn(shell, [], {
    cwd: __dirname,
    env: process.env
});

function createTempFileWithCode(code){
    return new Promise(function (resolve) {
        fs.writeFile('TempFiles/tempCode.cpp',code, function (err){
            if (err) throw err;
            resolve('File is created successfully.');
        });
    })
}

function createExectuableFile(){
    return new Promise(function (resolve, reject) {
        exec("g++ TempFiles/tempCode.cpp -o TempFiles/outputFile\r", (error, stdout, stderr) => {
            if (error) {
                reject(error.message);
            }
            else if (stderr) {
                reject(stderr);
            }
            else{
                resolve("Success!")
            }
        })
    })
}

io.on('connection', async socket => { 
    console.log("Connection Formed!")
    console.log(socket.id);
    
    socket.on("compile-code", async (code) => {
        await createTempFileWithCode(code);

        await createExectuableFile()
            .then(res => socket.emit("compile-code-msg", res))
            .catch(err => socket.emit("compile-code-msg", err));
    })

    socket.on("run-code", () => {    
        ptyProcess.write("cls\r");
        ptyProcess.write("./TempFiles/outputFile.exe\r");    
    })

    ptyProcess.on('data', function (output){
        console.log(output)
        socket.emit("code-output", output)
    });

    socket.on("send-input-value", (data) => {
        ptyProcess.write(data);
    });

    socket.on("debug-code", async (code) => {
try {
    const completion = await openai.complete({
        engine: 'text-davinci-003',
        prompt:`fix this c++ code \n${code}`,
        temperature:0,
        maxTokens:150,
        n: 1,
        frequency_penalty:0,
        presence_penalty:0.6,
        stop:[" Human:", " AI:"]
    });

    const { choices } = completion.data;
        socket.emit('gpt-response', choices[0].text);
        console.log(choices[0].text);
    } catch (error) {
    console.log(error);
    socket.emit('gpt-response', error);
    }
    })

})