# espresso-api
I use this project to track espresso recipe for 3 different beans and display on my TRMNL eInk display. 

Why so complex? In creating this site, I've found TRMNL was not able to consistently access my custom website from some free hosting services, so I ended up using github pages.  So my code will run a server locally (on a pi) generate an HTML file that can be exported to github pages, and ensure all images have direct links. In the past I also generated screenshots of the website, however, TRMNL does not check for updated images; it just loads them once and is done. 

The resulting website in my espresso repository is formated for the TRMNL eink display of 800x480.

Post commands can be used to submit changes to the website. The server then saves the changes and generates a screenshot of the website, and an output.html file with 
all the values hardcoded into the html file. This makes it portable so the server can be hosted locally, and the output.html can be ftp-ed to an external location. 

![EspressoRecipeExamples](https://github.com/user-attachments/assets/b174f8b9-1c4f-49da-9a14-756ac012f67d)

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

npm install axios




