QIDI Plus 5 Dashboard  (version {{VERSION}})
=============================================

A control panel for the QIDI Plus 5 and the QIDI Box (multi-color unit) that runs in your
web browser on this PC. It shows the printer's status, temperatures, camera and print files,
and lets you set each box slot's filament and color, load / unload / eject filament, and run
the filament dryer.

You need: a Windows 10 or 11 PC on the same network (Wi-Fi or cable) as the printer.
Nothing is installed on your PC, and nothing is sent to the internet.


HOW TO START
------------
1. Unzip this folder somewhere you'll find it again, for example in Documents.
   (Right-click the zip file > "Extract All...")

2. Double-click "Open Dashboard.bat".
   A small black window opens, then the dashboard opens in your web browser.
   Keep the black window open while you use the dashboard. Close it when you're done.

   If Windows warns you about the file:
     - "Windows protected your PC": click "More info", then "Run anyway".
     - "Open File - Security Warning": click "Run".

3. Click "Find my printer" (top right), then "Connect" next to your printer.
   (Or type the printer's IP address in the Printer box. You can find it on the printer's
   touchscreen in the network settings.)

4. First time only: if the Control Box panel says "Slot editing isn't set up",
   click "Set up slot editing". It backs up your printer settings first and puts them
   back automatically if anything goes wrong. Takes about 30 seconds.


TIPS
----
- To open it again later, double-click "Open Dashboard.bat" again. The printer address
  is remembered.
- Make a desktop shortcut: right-click "Open Dashboard.bat" > "Show more options" >
  "Send to" > "Desktop (create shortcut)".
- Use the printer's touchscreen or this dashboard to set box slots. Don't use the
  Filament / Color dropdowns in the printer's built-in web page (Fluidd) - they don't
  work with current QIDI firmware.


TROUBLESHOOTING
---------------
- "Find my printer" finds nothing: check the printer is on and connected to the same
  network as this PC, then click "Search again". Or type its IP address yourself.
- "Can't reach the printer": the address is wrong or the printer is off.
- The page doesn't open / "Could not start on port 8765": the dashboard is already
  running in another black window. Use that one, or close it and try again.
- The black window closes straight away: make sure you unzipped the whole folder first.
  Running "Open Dashboard.bat" from inside the zip file doesn't work.


More information, source code and updates:
https://github.com/jcazares76/Qidi-Plus-5-Mods
