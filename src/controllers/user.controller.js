import { asyncHandler } from "../utils/asyncHandler.js"
import { ApiError } from "../utils/ApiError.js"
import { User } from "../models/user.model.js"
import { uploadOnCloudinary } from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js"

const registerUser = asyncHandler( async(req,res) => {
    //1:get user details from frontend
    //2:validation - not empty
    //3:check if user for already exists: username, email
    //4:check for images, check for avatar
    //5:upload them to cloudinary, avatar
    //6:create user object - create entry in db
    //7:remove password and refresh token from response
    //8:check for user creation 
    //9:return res

    //step1
    const {fullName, username , email , password } = req.body
    //step2
    if(
        [fullName,email,username,password].some( (field) => field?.trim() === "" ) 
    )
    {
        throw new ApiError(400,"All fileds are required")
    }

    //step3
    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })

    if(existedUser){
        throw new ApiError(409, "User with email or username alreaady exists")
    }
    // console.log(req.body);
    
    //step4
    const avatarLocalPath = req.files?.avatar[0].path;
    // const coverImageLocalPath = req.files?.coverImage[0].path;

    let coverImageLocalPath;
    if(req.files &&  Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0 ){
        coverImageLocalPath = req.files?.coverImage[0].path;
    }

    if(!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required" )
    }

    //step5
    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if(!avatar) {
        throw new ApiError(400, "Avatar file is required" )
    }

    //step6
    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username
    })

    //step7:
    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    )
    //step8:
    if(!createdUser){
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    //step9:
    return res.status(201).json(
        new ApiResponse(200, createdUser, "User registered Successfully")
    )

} )

export {registerUser}