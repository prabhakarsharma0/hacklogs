---
title: I Hacked an Application… and What I Found Was Worse Than Expected.
category: Web Security
difficulty: Medium
date: 2026-11-27T10:12:00.000+05:30
---
What started as a routine security assessment turned into one of the most eye-opening findings I’ve encountered.

Most people imagine hacking as someone wearing a hoodie, typing furiously on a black screen while green text scrolls everywhere.

The reality is completely different.

Real-world security testing is slow, methodical, and all about understanding how an application behaves before attempting to exploit anything.

Recently, during an **authorized web application security assessment**, I experienced exactly that.

At first, everything looked perfectly normal.

But the deeper I went…

the worse things became.

## Step 1 — Understanding the Application

Like every assessment, I didn’t immediately start running automated tools.

Instead, I spent time understanding the application.

✔️ Exploring every page

✔️ Mapping available endpoints

✔️ Analyzing HTTP requests and responses

✔️ Identifying where user input interacted with the backend

This phase is often ignored by beginners, but it’s one of the most important parts of web application security testing.

The better you understand the application…

the easier it becomes to identify weak points.

## Step 2 — Digging Deeper

After exploring several functionalities, I noticed something interesting.

One particular input parameter behaved differently from the others.

Instead of simply rejecting unexpected values…

the server responded in a way that suggested the input might be reaching the database without proper validation.

That immediately caught my attention.

Rather than making assumptions, I carefully validated my observations using authorized testing techniques.

The more I tested…

the stronger the evidence became.

Eventually, I confirmed the application was vulnerable to **SQL Injection (OWASP A03: Injection).**

At that moment I thought…

“Great… I found one vulnerability.”

I had no idea that wasn’t the biggest problem.

## Step 3 — The Part That Shocked Me

With proper authorization, I safely enumerated the affected database to understand the actual impact.

I expected to find application records.

Maybe user IDs.

Perhaps email addresses.

Instead…

I found something I wasn’t expecting.

A user table.

Containing usernames.

Emails.

And passwords.

Not hashed.

Not encrypted.

Just plaintext.

I actually paused for a second.

Because SQL Injection is dangerous.

But SQL Injection combined with plaintext passwords…

is a completely different level of risk.

## Why This Is Dangerous

Imagine an attacker exploiting this vulnerability.

Normally…

Even after gaining database access, they would still need to crack password hashes.

That process can take hours.

Days.

Sometimes weeks.

But in this case…

There was nothing to crack.

The passwords were already readable.

That means an attacker could immediately:

• Access user accounts

• Perform credential stuffing attacks

• Target users who reuse passwords

• Potentially compromise multiple services beyond the affected application

This is why storing passwords in plaintext is considered one of the most serious security mistakes.

## Attack Chain

Here’s how one weakness led to another.

Notice something?

The SQL Injection wasn’t the only problem.

It became dangerous because another critical weakness already existed.

## How Could This Have Been Prevented?

Fortunately, preventing issues like this isn’t impossible.

Some basic security practices could have completely eliminated the risk.

✔ Use Parameterized Queries (Prepared Statements)

✔ Validate every user input on the server

✔ Never build SQL queries dynamically

✔ Store passwords using Argon2id, bcrypt, or scrypt

✔ Apply the Principle of Least Privilege

✔ Conduct regular security assessments and penetration tests

Security is strongest when multiple layers work together.

## Final Thoughts

This assessment reminded me that real security incidents rarely happen because of a single vulnerability.

Instead…

They’re often the result of multiple weaknesses combining together.

One bug opens the door.

Another bug makes the impact catastrophic.

As security professionals, our responsibility isn’t just to find vulnerabilities.

## 🔒 Disclaimer

This assessment was performed **only on an authorized target** with proper permission. All identifying information, screenshots, and sensitive data have been intentionally blurred to protect the organization’s confidentiality.

Press enter or click to view image in full size![](https://miro.medium.com/v2/1*j-Hb9dwe8c_RrU3GcBDnZQ.jpeg)
