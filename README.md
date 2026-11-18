# YalePaths

## Demo video

https://youtu.be/lOuIaLaOH3k

## Hackathon build screenshot

![Grok session used to build YalePaths](docs/grok-proof.webp)

## What is YalePaths?

YalePaths is a community atlas for the question, “Where is everyone going this summer?” Yale students and alumni can voluntarily add an internship, research project, job, study abroad experience, or other opportunity. Each entry records the role, organization, city, dates, and an optional lab and note. Members decide when an entry becomes visible to the rest of the community.

The shared entries become a searchable map and directory. A student considering an internship can look up the organization, see who has worked there, and ask a more personal question than a job description can answer. Someone moving to a new city can find other Yale members nearby. Alumni can contribute their own experience and stay available to students exploring a similar path. Past experiences remain useful after the summer ends, as long as their owners keep them shared.

## Explore the features

### Find people by place

The Explore page pairs an interactive map with an index of shared experiences. Selecting a city pin narrows the list to that location; zooming in can show organizations within the city. Filters for year and experience type apply to the pins on the map as well as to the list, so both stay on the same set of internships, research, jobs, study abroad, and other experiences.

### Search for an opportunity

Search by city, organization, or lab. Narrow the results by experience type — internship, research, job, study abroad, or other — and by year. The list and the map update together. A year includes every experience that overlaps it. Results show the organization, member, and dates, so students can find someone whose experience is relevant to the opportunity they are considering.

### Add an experience on your terms

Members can add a role, organization, location, dates, and optional context. New entries start private. A member can share, edit, hide, or delete an entry later, keeping control over what appears in the atlas.

### Learn from a member and connect

A shared entry opens its member's profile, where visitors can see that person's other shared experiences and any contact details they chose to show. Members can also start a private conversation inside YalePaths to ask about a workplace, application process, or city.

## Why it matters

Summer plans can scatter a campus community across cities, labs, and workplaces. YalePaths makes those connections discoverable by the people who can benefit from them: students looking for firsthand advice, peers hoping to meet up in a new place, and alumni who want to share what they have learned. Because contributions are voluntary and private by default, the atlas can grow through community participation without requiring anyone to publish their plans.

## How it was built

The interface uses Next.js, React, and TypeScript. Supabase provides the database and member sessions; database access rules keep private experiences and conversations limited to their owners and participants. The Explore map uses Leaflet and OpenStreetMap tiles, with the map and list driven by the same shared entries. YalePaths is an independent student project, not an official Yale University service.

## Run locally

You need Node.js 20+, Docker, and the [Supabase CLI](https://supabase.com/docs/guides/local-development).

```bash
npm install
npx supabase start
npx supabase status
cp .env.example .env.local
```

In `.env.local`, fill in `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` with the API URL, anon key, and service role key shown by `npx supabase status`. The Mapbox token is optional.

```bash
npm run seed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The local demo accepts a `@yale.edu` address without sending an email, and the seed command adds sample members and experiences to explore. Seeding is restricted to a local Supabase instance.
