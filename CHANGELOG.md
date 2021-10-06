# Kanmi Sequenzia Framework

## v17 (RC1 JFS v1.5)
### Important Notes
This update requires Kanmi v19 to be applied

### Change Log
Severity: **Critical**<br>
- All management for items are merged into one button and uses a model to select the action
- Moved Repair Spanned File button to new manage menu for admins
- Added support to add custom items to index sidebar
- Server icon order has been reversed so that icons on the left are overlapping right items. AuthWare servers are no longer pushed to the top. Position is completely in control
- Fixed various issues with the back button and pagelist functions
- Added more URI encoding to prevent page loops when attempting to go back
- Added toggle to disable showing a display in the History view, you will always be able to see the display if you implicit request it from the Ambient History view
- Users can now set a name overide that will show insted of there discord name
- Corrected another issue with Ambient Displays looping due to bad sync pulse for a master that is either offline or did not boot fast enough
- Pageinator moved to total count number
- Added support to set URI overide for virtual channels
- Added support to set URI overide for channels
- Adjusted conditions for when a redirect will occur, due to a issue with ADS Mobile where if you favorite a image when session expires it will try to request a an impossible URL
- Updated to new attachment Hash
- Uses Discord CDN and Media CDN for preview images when ever possible, will use SizeH and SizeW to calculate the resolution request to the CDN
- Now returns server image inplace of default image for podcasts
- Added server image override to config file to add high quality images for things like podcasts
- Added support for JFIF file format
- Added support for Sequenzia Randomizer Embed History
- Added support to support by album add date

### Configuration File Updates
None of the options are required for operations
#### host.config.json
```json
{
"telegram_secret" : "SECRETFROMTLEGRAM",
"telegram_callback_url" : "https://seq.moe/telegram/callback",
"telegram_bot_name" : "sequenzia_authware_bot"
}
```
- Added Telegram Login

#### web.config.json
```json
{
  "pinned_user": "716194461306191914",
  "index_items": [
    {
      "tooltip": "Global Artists Directory",
      "name": "Artists",
      "url": "/artists"
    },
    null,
    {
      "tooltip": "Images from Twitter",
      "name": "Twitter Images",
      "url": "/gallery?search=text:Twitter Image&title=Twitter Images&numdays=120"
    },
    {
      "tooltip": "Images from Pixiv",
      "name": "Pixiv Images",
      "url": "/gallery?search=text:\uD83C\uDF86 &title=Pixiv Images&numdays=120"
    },
    null,
    {
      "tooltip": "Media over 8MB",
      "name": "Large Media",
      "url": "/gallery?search=text:\uD83E\uDDE9 File &title=Large Media&numdays=120"
    }
  ],
  "server_avatar_overides": {
    "716206086947864617": "https://cdn.discordapp.com/attachments/827315100998172693/895151683473113088/juzo1.png",
    "849858527375523870": "https://cdn.discordapp.com/attachments/827315100998172693/895151684991451166/juzo2.png"
  }
}
```
- Set Pinned User in Index
- Set items for Index menu
- Set server image override for high quality images for Podcasts and RSS feed images

## v16 (RC1 JFS v1.4)
Severity: **Medium**<br>
- Readded the "waves" background to Files view
- Added slight translucent background to file list for contrast with background
- Added history search
- Removed history view from Ambient System
- Clicking a display will now search its history in the normal gallery view
- Added Sort by Displayed history
- Added new History button to side bar to see all history
- Added True Random to ADS Lite, this will extend history to 50000 to keep deep history of images to prevent duplicate images, once it has detected its running out of images it will reset
- History depth has been increased to 75 images
- Added browse history
- Updated About dialog to include list of beta testers
- Fixed bugs with Ambient Display History, Config,  and Set as ADS
- Custom name can be set for all ADS displays (You can set a `displayname=dis001` as set a Friendly Name as `My Pictures`)
- Custom ADS Names will now be displayed in history and gallery view
- Homepage can now have custom image request set from Ambient Settings
- Errors on Ambient Displays are more clear of what actually happened instead of generic "Failed to get response"
- ADS Lite has been overhauled to use much lighter weight client side code and now all request generation happens server side to keep display settings in sync instantly.
- Added configuration option to set discord join link for login
- Added configuration for telegram login config, forgot to move those out
- Fixed Album Manager to remember messageid when you create a new album and still need to add the last item to a album
- Now Album Manager does not close after adding item
- Videos will now appear in gallery view
- Videos with out thumbnails will be send for generation
- Added URI overides for classes
- Added custom support text
- Added custom pinned posts userid
- Moving urls that do not require pre-proccessing to direct hash changes, this makes it possible to do "Open in new tab" or copying lines that actually have values

