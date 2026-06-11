import { EventSchemas, Inngest } from "inngest";
import { inngestAppId } from "@/lib/config";

type Events = {
  "photo/uploaded": {
    data: {
      photoId: string;
    };
  };
};

export const inngest = new Inngest({
  id: inngestAppId,
  schemas: new EventSchemas().fromRecord<Events>(),
});
