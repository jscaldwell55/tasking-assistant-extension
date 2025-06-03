A Chrome extension that copies fields between browser tabs using shareable text configurations. 
<br>

🚀 Quick Start
Installation (Prototype)

Download the extension files

Clone this repo or download as ZIP
Extract to a folder on your computer


Install in Chrome

Open Chrome and go to chrome://extensions/
Enable Developer Mode (toggle in top right)
Click "Load unpacked"
Select the extension folder
Pin the extension icon to your toolbar 📌



Your First Copy

Open your source page (e.g., Outlier platform)
Open your destination form (e.g., Google Form)
Click the extension icon in your toolbar
Paste this example configuration:
SOURCE_TAB_NAME: Outlier
DESTINATION_TAB_NAME: Submission Form

SOURCE -> DESTINATION
1 -> 1
2 -> 3
3 -> 2
4 -> 4

Click "Save Configuration"
See the green checkmarks ✅? Click "COPY FIELDS"
Check your form - fields are filled! 🎉

📋 Configuration Guide
Understanding Field Mappings
The configuration tells the extension which fields to copy and where to put them:
SOURCE_TAB_NAME: [text that appears in source tab title]
DESTINATION_TAB_NAME: [text that appears in destination tab title]

SOURCE -> DESTINATION
[source field number] -> [destination field number]
How Fields Are Numbered
Fields are counted in order of appearance:

Field 1 = First input/text box on the page
Field 2 = Second input/text box on the page
And so on...

Example: If you want to copy the 3rd field from your source to the 2nd field in your form:
3 -> 2
Real-World Example
Let's say you're copying from Outlier to a Google Form:

Outlier has: Name (1), Email (2), Task Response (3), Quality Score (4)
Form wants: Email (1), Quality Score (2), Name (3), Task Response (4)

Your configuration:
SOURCE_TAB_NAME: Outlier
DESTINATION_TAB_NAME: Google Forms

SOURCE -> DESTINATION
1 -> 3
2 -> 1
3 -> 4
4 -> 2
👥 Team Workflow
For Team Leads

Create the configuration for your project
Test it using the extension
Share via Slack/Email:
Team: Here's the config for Project X
Copy everything between the lines:
-----------
SOURCE_TAB_NAME: Outlier
DESTINATION_TAB_NAME: Project X Form

SOURCE -> DESTINATION
1 -> 1
2 -> 3
3 -> 2
4 -> 4
-----------


For Team Members

Copy the configuration from Slack/Email
Open the extension
Paste in the text box
Click "Save Configuration"
Start copying fields with one click!

🎨 Using Presets
The extension includes preset buttons for common platforms:

Outlier → Form: Click this if you're using Outlier
Scale → Form: Click this if you're using Scale
Custom: Start with a blank template

After selecting a preset, just update the tab names to match your actual tabs.
🔧 Troubleshooting
"No tabs found matching..."

Make sure your configuration tab names match what's in your browser
The match is partial - "Outlier" will match "Outlier - Task 123"
Check for typos in your configuration

"No fields could be extracted"

Refresh the source page (Ctrl+R or Cmd+R)
Make sure the page is fully loaded
Check that fields have values to copy

"Multiple tabs found"

Close duplicate tabs
Keep only one source and one destination tab open

Copy button is disabled

Need exactly ONE source tab and ONE destination tab
Both must match your configuration
Check the status indicators for details

💡 Pro Tips

Test First: Always test with one record before doing bulk work
Save Common Configs: Use meaningful names when sharing configs
Field Discovery: Not sure which field is which? Try copying one at a time:
SOURCE -> DESTINATION
1 -> 1
Then test fields 2, 3, 4, etc.
Quick Updates: The extension checks for tabs every 2 seconds, so changes appear quickly

🛡️ Privacy & Security

✅ All data stays in your browser
✅ No external servers or data collection
✅ Configuration stored locally
✅ Only accesses tabs you explicitly configure

📝 Example Configurations
Outlier to Google Form
SOURCE_TAB_NAME: Outlier
DESTINATION_TAB_NAME: Task Submission

SOURCE -> DESTINATION
1 -> 1
2 -> 3
3 -> 2
4 -> 4
Scale AI to Internal Form
SOURCE_TAB_NAME: Scale
DESTINATION_TAB_NAME: Quality Review

SOURCE -> DESTINATION
1 -> 2
2 -> 4
3 -> 1
4 -> 3
5 -> 5
Multi-Field Project
SOURCE_TAB_NAME: Feather
DESTINATION_TAB_NAME: Data Collection

SOURCE -> DESTINATION
1 -> 1
2 -> 2
3 -> 5
4 -> 3
5 -> 4
6 -> 6
7 -> 8
8 -> 7
