import { EventSchemas, Inngest } from "inngest";

type Events = {
  "photo/uploaded": {
    data: {
      photoId: string;
    };
  };
};

export const inngest = new Inngest({
  id: "soteria-dam",
  schemas: new EventSchemas().fromRecord<Events>(),
});
