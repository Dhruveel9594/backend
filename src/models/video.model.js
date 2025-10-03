import mongoose,{Schema} from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";


const videoSchema = Schema(
    {
        videoFile:{
            type: String,
            required: true // cloudinary url
        },
        thumbnail: {
            type: String,
            reqired: true
        },
        title: {
            type: String,
            reqired: true
        },
        description: {
            type: String,
            reqired: true
        },
        duraion: {
            type: Number,
            required: true
        },
        views: {
            type: Number,
            default: 0
        },
        isPublished:{
            type: Boolean,
            default: true
        },
        owner: {
            type: Schema.Types.ObjectId,
            ref: "User",
        },
    },
    {
        timestamps: true
    }
)

videoSchema.plugin(mongooseAggregatePaginate)

export const Video = mongoose.model("Video", videoSchema)