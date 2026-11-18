# YalePaths

## Demo video

https://youtu.be/lOuIaLaOH3k

## Screenshot

![Grok session used to build YalePaths](docs/grok-proof.webp)

## What is YalePaths?

YalePaths is an atlas of where the Yale community spends its summers. Students and alumni can voluntarily share an internship, job, research project, or other experience, including its organization, location, dates, and a short note. Each entry starts private; its owner chooses whether to share it with other members.

The atlas turns those shared experiences into a way to find people and advice. Members can explore a map or list, search by city, organization, or lab, and filter by year and experience type. Someone heading to a new city can find Yale students and alumni who are there or have been there before, open their profiles, and send a private message to ask about an internship, workplace, or life in that location.

YalePaths is built with Next.js, React, Supabase, and OpenStreetMap. It is an independent student project, not an official Yale University service.

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
