# espresso-api
Used to track espresso recipe for 3 different beans.  

The resulting website in my espresso repository is formated for the TRMNL eink display of 800x480.

Post commands can be used to submit changes to the website. The server then saves the changes and generates a screenshot of the website, and an output.html file with all the values hardcoded into the html file. This makes it portable so the server can be hosted locally, and the output.html can be ftp-ed to an external location. 

![output](https://github.com/user-attachments/assets/0f77c6c1-49cd-4951-bc62-79d600c32fa7)

## Installation

Clone repository
npm install

## update

git pull && npm install

##Server commands

### restart

sudo systemctl restart espresso-api.service

### server log

 sudo journalctl -u espresso-api.service -f

## Dependancies
npm install simple-git

npm install fs-extra

npm install ssh2

npm install express

npm install node-fetch



