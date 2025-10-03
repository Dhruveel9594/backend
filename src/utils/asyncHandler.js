const asyncHandler = (requestHandler) => {
    // Return a new function that Express can use as a route handler

    (req,res,next) => {
        // Call the original requestHandler and wrap it in Promise.resolve()
        // This ensures that both sync and async functions are handled as Promises
        Promise.resolve(requestHandler(req,res,next))// If the Promise is rejected (i.e., an error occurs), catch it
        .catch((err) => next(err)); // Pass the error to Express's error handling middleware
    }
}

export {asyncHandler}