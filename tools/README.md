Overview
========

The `realityframes` repository contains a set of applications that can be added to an AR environment using the Reality Editor.

Setup Instructions
==================

Clone this repository into your `~/Documents` directory. If you have already started to run a Reality Server on your computer, it will have generated an empty `realityframes` directory in the necessary location. Replace that directory with this repository.

How it interacts with the Reality Server
========================================

From then on, if you run a Reality Server on your computer, it will browse the contents of this repository and load each of the frames (applications) into the set of possible frames that the server hosts and knows how to process. If you go to `http://localhost:8080` in your web browser, and click on `Global Frames`, you should see a row for each of the directories inside of this repository. Frames can be enabled or disabled via this interface. The enabled state of each frame XYZ is stored persistently in `realityframes/.identity/XYZ/settings.json`, which will be automatically generated when you run the Reality Server if you haven't manually created one.

How to create a new frame
=========================

To create a new frame, simply create a new directory inside this repository. The name of the directory will be the name of your frame. Your frame's directory should contain at least two files:

 - index.html
    - This is your application! You can build this similar to any standard web page, and the result will be available to add to your AR environment through the Reality Editor. To interact with the Reality Editor AR capabilities, your html file should include `<script src="objectDefaultFiles/object.js">`. The `object.js` file contains the RealityInterface API, and will be injected at that location. For more information on building frames and using the RealityInterface API, see our additional documentation. 
 - icon.gif
   - This is the icon that will appear in the menu and Reality Editor pocket. It will be scaled to fit, so a specific pixel size is not necessary, but a small file on the order of 256px x 256px will work well. To check that your icon has been added correctly, check if it appears next to the name of the frame on the Global Frames section of `localhost:8080` when the Reality Server is running.

Deleting a frame's directory will completely delete that frame from the server. To temporarily disable a frame from appearing available to clients, it can be disabled on `localhost:8080`.
