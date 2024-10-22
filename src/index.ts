import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono, HonoRequest, MiddlewareHandler } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { logger } from "hono/logger";
import { HTTPExceptionFunction, timeout } from "hono/timeout";

import Data from "./data/products.json" with { type: "json" };
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

const { categories: CATEGORIES, products: PRODUCTS } = Data.reduce(
  (acc, product, index) => {
    const { category, ...restProductFields } = product;
    let categoryId = acc.categories.find(
      (_category) => _category.name === category
    )?.id;

    if (categoryId === undefined) {
      categoryId = acc.categories.length + 1;
      acc.categories.push({ name: category, id: categoryId });
    }

    acc.products.push({ id: index + 1, categoryId, ...restProductFields });
    return acc;
  },
  { categories: [], products: [] } as {
    categories: Array<Category>;
    products: Array<ResponseProduct>;
  }
);

// const schema = z.object({
//   data: z.array(
//     z.object({
//       productId: z.number(),
//       qty: z.number().min(1),
//       note: z.string().nullable(),
//     })
//   ),
// });

const schema = z.object({
  data: z.array(
    z.object({
      productId: z.number(),
      qty: z.number().min(1),
      note: z.string().optional(),
    })
  ),
});

const app = new Hono();

app.use("/*", cors());
app.use(logger());
app.use(timeout(6_000));

app.use("/api/*", async (_, next) => {
  await next();
  const prob = Math.random();
  if (prob < 0.25) {
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 30_000));
  } else if (prob > 0.75) {
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 5_000));
  }
});

app.use("/public/*", async (_, next) => {
  await next();
  const prob = Math.random();
  if (prob < 0.33) {
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 5_000));
  } else {
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 2_000));
  }
});

app.use("/public/*", serveStatic({ root: "./" }));

app.get("/", (c) => {
  return c.json({
    title: "Hello Hono!",
  });
});

app.get("/api/v1/categories", async (c) => {
  console.log("Categories", CATEGORIES);

  return c.json({
    data: CATEGORIES,
  });
});

app.get("/api/v1/products", async (c) => {
  const page = c.req.query("page");
  const categoryId = c.req.query("categoryId");

  const paginatedProducts = paginate(
    PRODUCTS,
    page === undefined ? 1 : parseInt(page),
    categoryId ? parseInt(categoryId) : undefined
  );

  return c.json({
    data: paginatedProducts.data,
    meta: paginatedProducts.meta,
  });
});

app.post("/api/v1/orders", zValidator("json", schema), async (c) => {
  // app.post("/api/v1/orders", async (c) => {
  const { data } = await c.req.json();
  console.log("data", data);

  return c.json({
    data,
  });
});

const port = 4004;
console.log(`Server is running on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});

//

function paginate(collection: Array<ResponseProduct>, page: number, categoryId?: number) {

  if (categoryId) {
    collection = collection.filter((product) => {
      return product.categoryId === (categoryId)
    });
  }

  const perPage = 10;
  let totalPages = collection.length / perPage;
  totalPages = Math.ceil(totalPages);
  const totalElements = collection.length;

  let currentPage = Math.max(page, 1);
  currentPage = Math.min(currentPage, totalPages);

  return {
    data: collection.slice(
      (currentPage - 1) * perPage,
      Math.min(currentPage * perPage, collection.length)
    ),
    meta: {
      perPage,
      totalPages,
      currentPage,
      totalElements,
    },
  };
}

type Category = { id: number; name: string };
type Product = {
  name: string;
  description: string;
  price: string;
  currency: string;
  category: string;
  available: boolean;
  minAmount: number;
  maxAmount: number;
  image: string;
};

type ResponseProduct = Omit<Product, "category"> & {
  id: number;
  categoryId: number;
};
