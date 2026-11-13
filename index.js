#!/usr/bin/env node

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { program } = require('commander');
const { GoogleGenAI } = require('@google/genai');

// 1. CLI ka Setup
program
  .name('smart-seed')
  .description('AI dummy data generator for Prisma')
  .version('1.0.0')
  .option('-s, --schema <path>', 'Path to your schema.prisma file', './prisma/schema.prisma');

program.parse(process.argv);
const options = program.opts();
const schemaPath = path.resolve(process.cwd(), options.schema);

// 2. AI Client ka Initialization
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function runSeeder() {
  console.log(`🔍 Looking for Prisma schema at: ${schemaPath}`);

  let schemaText = '';
  try {
    schemaText = fs.readFileSync(schemaPath, 'utf-8');
    console.log('✅ Schema file successfully read!\n');
  } catch (error) {
    console.error(`\n❌ Error: schema.prisma file nahi mili!`);
    process.exit(1);
  }

  // 3. AI Generation ka Logic
  console.log('⏳ AI is analyzing the schema and generating data...');

  const prompt = `
  Act as a PostgreSQL database seeder. Read the following Prisma schema:
  """
  ${schemaText}
  """
  Generate highly realistic dummy data for the models. 
  Return ONLY a valid JSON object where keys are model names and values are arrays containing 3 realistic records each.
  Do not return markdown formatting, do not use backticks, just raw JSON.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    const rawText = response.text;
    const cleanJson = rawText.replace(/```json/gi, '').replace(/```/gi, '').trim();

    const seedData = JSON.parse(cleanJson);
    console.log('✅ AI successfully generated the data!\n');

    // Preview hua generated JSON
    console.log(JSON.stringify(seedData, null, 2));

    const { PrismaClient } = require('@prisma/client');
   const prisma = new PrismaClient();

   console.log('🚀 Pushing data to database...');

   for (const [modelName, dataArray] of Object.entries(seedData)) {
       // Prisma client functions usually lowercase se start hote hain (e.g., prisma.user)
       const prismaModelName = modelName.charAt(0).toLowerCase() + modelName.slice(1);
       
       if (prisma[prismaModelName]) {
           await prisma[prismaModelName].createMany({ 
               data: dataArray,
               skipDuplicates: true 
           });
           console.log(`✅ Seeded ${dataArray.length} records into '${modelName}'`);
       } else {
           console.log(`⚠️ Model '${modelName}' Prisma client mein nahi mila.`);
       }
   }
   
   console.log('\n🎉 All done! Database is successfully seeded.');
   await prisma.$disconnect();

  } catch (error) {
    console.error('\n❌ AI Data generation failed:', error.message);
    console.error('Check if your API key is correct and valid in the .env file.');
    process.exit(1);
  }
}

runSeeder();