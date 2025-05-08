# cpsc 455 secure chat
Created by Dylan Werelius & Victoria Guzman <br>
https://secure-chat-evergarden.glitch.me
 
Instructions for running:

1. navigate to the SecureChat directory with "cd SecureChat"
2. a. type "npm i ws bcryptjs jsonwebtoken dotenv sqlite3 sqlite express"
   b. type "npm install electron --save-dev"
   c. type "npm install electron-packager --save-dev"
3. create a file called .env at the in the SecureChat folder
4. open the .env file and type "SECRET_KEY=3v3rg@rd3n" (without the quotes obviously) and save it
5. to get a distribution (.exe file) type "npx electron-packager . SecureChat --platform=win32 --arch=x64 --out=distribution"

Dev Testing:
- To make sure the server is running, ssh to the pi and type "netstat -tulnp | grep 80" in the console.
- If nothing comes up, then it is not running.
- If its running, you should get "tcp    0   0 0.0.0.0:80         0.0.0.0:*        LISTEN      -"
