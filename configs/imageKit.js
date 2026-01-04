import ImageKit from "@imagekit/nodejs";

const key = process.env.IMAGEKIT_PRIVATE_KEY || process.env.IMAGEKIT_PRIVATEKEY;

let imagekit;
try {
  if (key) {
    imagekit = new ImageKit({ privateKey: key });
  } else {
    imagekit = {
      files: {
        upload: async () => ({ url: null }),
      },
    };
  }
} catch (e) {
  imagekit = {
    files: {
      upload: async () => ({ url: null }),
    },
  };
}

export default imagekit;
