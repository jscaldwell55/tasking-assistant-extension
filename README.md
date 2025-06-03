Tasking Assistant Chrome Extension
A Chrome extension that automates copying fields between browser tabs using centralized configuration via Google Docs. Perfect for teams working with tasking platforms (Outlier, Feather, Scale) who need to submit data to Google Forms or other web forms.

OVERVIEW

This extension allows:

Configuration Leads (CLs) to define field mappings in a Google Doc
Contributors to automatically copy data from tasking platforms to submission forms
Teams to share one configuration across hundreds of users

SETUP

For All Users

Clone this repo or download the extension files
In Chrome, go to chrome://extensions
Enable Developer Mode (toggle in top right)
Click "Load unpacked" and select the extension folder
Pin the extension to your toolbar for easy access

For Central Config

Create a Google Doc with your field mapping configuration:
SOURCE_TAB_NAME: Outlier
DESTINATION_TAB_NAME: Q4 Submission Form

SOURCE -> DESTINATION
1 -> 1
2 -> 3
3 -> 2
4 -> 4

Share the Google Doc with view permissions for your team
Copy the shareable link to distribute to contributors

For Contributors

Install the extension following the setup steps above
Get the configuration Google Doc URL from your CL
Click the extension icon and go to "Load from URL" tab
Paste the Google Doc URL and click "Load Configuration"
The configuration is now saved and ready to use

USAGE

Daily Workflow

Open the source tab (e.g., Outlier, Feather)
Complete your task on the platform
Open the destination tab (e.g., Google Form)
Click the Tasking Assistant extension icon
Verify both tabs show green checkmarks
Click "COPY FIELDS" to transfer your data
Submit the form

Configuration Methods
The extension supports three ways to configure field mappings:
1. Google Docs URL (Recommended for Teams)

Maintain a central Google Doc
Contributors load configuration via URL
Updates are centralized - change once, update everyone

2. Manual Configuration

Edit mappings directly in the extension
Good for individual users or testing
Saved locally to your browser

3. Saved Presets

Save frequently used configurations
Quick switching between projects
Share preset configurations with team

CONFIG FORMAT

SOURCE_TAB_NAME: [Part of source tab title]
DESTINATION_TAB_NAME: [Part of destination tab title]

SOURCE -> DESTINATION
[source field #] -> [destination field #]
[source field #] -> [destination field #]
...
Field Numbering
Fields are numbered sequentially:

Field 1 = First input/textarea element
Field 2 = Second input/textarea element
And so on...

NOTES

Important Limitations

If multiple matching tabs are open, the COPY button will be disabled
Only one source and one destination tab can be open at a time
The extension matches tabs by partial title text

Troubleshooting
"No fields found" error

The page structure might be different than expected
Check browser console for detected fields
Contact your CL to update mappings

Multiple tabs detected

Close duplicate tabs with similar titles
Ensure only one source and one destination tab are open

Configuration won't load

Verify the Google Doc is publicly viewable
Check that the URL is a valid Google Docs link
Try using manual configuration as fallback

Google Doc Config Tip

Use the manual configuration tab to test mappings
Once verified, copy to Google Doc for team distribution


CONTRIBUTING

To contribute to this extension:

Fork the repository
Create a feature branch
Test thoroughly with various form types
Submit a pull request

DEV NOTES

manifest.json - Extension configuration
popup.html/js - Main UI and configuration logic
content.js - Field extraction and filling logic
background.js - Service worker for tab management
