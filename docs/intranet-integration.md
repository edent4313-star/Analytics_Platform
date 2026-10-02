# CBE Enterprise Dashboard — Intranet Integration Guide

## The Platform URL

Once deployed on the CBE internal server, the platform is accessible at:

```
http://analytics.cbe.com.et/
```
or if using IP:
```
http://10.x.x.x/
```

When a CBE employee clicks this link → they see the login page → they authenticate → they see their dashboards.

---

## How to Add It to the CBE Intranet Portal

### Option 1 — Simple Text Link (easiest)

Ask the CBE intranet team to add this anywhere on the portal:

```html
<a href="http://analytics.cbe.com.et/" target="_blank">
  CBE Enterprise Dashboard
</a>
```

### Option 2 — Clickable Tile (recommended)

Copy and paste this HTML tile directly into the intranet page:

```html
<a href="http://analytics.cbe.com.et/"
   target="_blank"
   style="
     display: block;
     width: 280px;
     background: linear-gradient(135deg, #1a3a5c, #0f2540);
     border-radius: 12px;
     padding: 24px;
     color: white;
     text-decoration: none;
     font-family: Segoe UI, Arial, sans-serif;
     box-shadow: 0 4px 16px rgba(0,0,0,0.2);
   ">
  <div style="font-size:18px; font-weight:700; margin-bottom:8px;">
    📊 CBE Enterprise Dashboard
  </div>
  <div style="font-size:13px; opacity:0.85; margin-bottom:16px;">
    Analytics and reporting platform for CBE staff.
    FCY leads, branch performance, customer analytics and more.
  </div>
  <div style="background:rgba(255,255,255,0.2); border-radius:6px;
              padding:8px 16px; text-align:center; font-weight:600;
              font-size:13px;">
    Open Dashboard Portal →
  </div>
</a>
```

### Option 3 — Embed as iFrame Tile

If the CBE intranet supports iframes, embed the pre-built tile:

```html
<iframe
  src="http://analytics.cbe.com.et/portal-embed.html"
  width="320"
  height="220"
  frameborder="0"
  scrolling="no"
  style="border-radius:12px; overflow:hidden;">
</iframe>
```

The `portal-embed.html` file is included in the deployed platform.

---

## Platform Name

**Official name:** CBE Enterprise Dashboard

**Short name (for menu items):** CBE Dashboard

**Internal code name:** analytics-platform

---

## What Happens When a User Clicks the Link

```
1. User clicks link on CBE intranet
2. Browser opens: http://analytics.cbe.com.et/
3. Login page appears: "Commercial Bank of Ethiopia — CBE Enterprise Dashboard"
4. User enters Employee ID and password
   (Development: CBE001 / Demo@1234)
   (Production: their normal CBE AD / Windows credentials)
5. User is authenticated
6. User sees their personalized dashboard home
   - Branch Manager: sees only their branch dashboards
   - Regional Manager: sees all dashboards for their region
   - Head Office: sees all dashboards they have permission for
7. User clicks a dashboard and sees their data
```

---

## What to Tell the CBE Intranet Team

Send them this message:

> We have deployed the CBE Enterprise Dashboard on the internal server.
> The URL is: http://analytics.cbe.com.et/
>
> Please add a link or tile on the intranet portal so CBE staff can access it.
> The tile title is "CBE Enterprise Dashboard".
> When clicked, it should open the URL above.
> It can open in a new tab (target="_blank").
>
> We have provided a ready-made tile (HTML snippet) and an iframe embed
> option in our documentation if the portal supports them.
> Please contact [your name] for any integration questions.

---

## After Deployment Checklist

- [ ] Server is running and accessible on CBE internal network
- [ ] URL opens the login page in a browser
- [ ] Test login with a real CBE employee (after OIDC is configured)
- [ ] Intranet team has added the link/tile
- [ ] Link tested from different CBE office locations
- [ ] HTTPS configured (optional but recommended)
