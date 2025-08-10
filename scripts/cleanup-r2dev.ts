import prisma from "../src/dbConfig";

async function main() {
  const target = 'r2.dev';

  const before = await prisma.photo.count({ where: { url: { contains: target } } });
  console.log(`Photos with url containing '${target}': ${before}`);

  if (before === 0) {
    console.log('Nothing to delete.');
    return;
  }

  const deleted = await prisma.photo.deleteMany({ where: { url: { contains: target } } });
  console.log(`Deleted photos: ${deleted.count}`);

  const after = await prisma.photo.count({ where: { url: { contains: target } } });
  console.log(`Remaining matching photos: ${after}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


