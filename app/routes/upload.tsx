import { type FormEvent, useState } from "react";
import Navbar from "~/components/Navbar";
import FileUploader from "~/components/FileUploader";
import { usePuterStore } from "~/lib/puter";
import { useNavigate } from "react-router";
import { convertPdfToImage } from "~/lib/pdf2img";
import { generateUUID } from "~/lib/utils";
import { prepareInstructions } from "../../constants";

const Upload = () => {
  const { fs, ai, kv } = usePuterStore();
  const navigate = useNavigate();
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const handleAnalyze = async ({
    companyName,
    jobTitle,
    jobDescription,
    file,
  }: any) => {
    setIsProcessing(true);
    try {
      setStatusText("Uploading original resume...");
      const pdfUpload = await fs.upload([file]);
      const uploadedFile = Array.isArray(pdfUpload) ? pdfUpload[0] : pdfUpload;

      setStatusText("Converting to image for AI...");
      const imageResult = await convertPdfToImage(file);
      if (imageResult.error || !imageResult.file)
        throw new Error(imageResult.error);

      setStatusText("Finalizing image upload...");
      const imgUpload = await fs.upload([imageResult.file]);
      const uploadedImage = Array.isArray(imgUpload) ? imgUpload[0] : imgUpload;

      setStatusText("Analyzing with AI... (this may take a moment)");
      const feedback = await ai.feedback(
        uploadedFile.path,
        prepareInstructions({ jobTitle, jobDescription }),
      );

      if (!feedback) throw new Error("AI failed to respond.");

      // Extract text content from the AI response 🤖
      const feedbackText =
        typeof feedback.message.content === "string"
          ? feedback.message.content
          : feedback.message.content[0].text;

      // upload.tsx logic around line 55

      // 1. Log the response so we can see why it's apologizing 🕵️‍♂️
      console.log("RAW AI RESPONSE:", feedbackText);

      // 2. Use a Regex to find the JSON block (everything between { and })
      const jsonMatch = feedbackText.match(/\{[\s\S]*\}/);

      if (!jsonMatch) {
        throw new Error(
          "The AI didn't provide a score. It said: " + feedbackText,
        );
      }

      // 3. Parse ONLY the matched JSON
      const parsedFeedback = JSON.parse(jsonMatch[0]);

      const uuid = generateUUID();
      const data = {
        id: uuid,
        resumePath: uploadedFile.path,
        imagePath: uploadedImage.path,
        companyName,
        jobTitle,
        jobDescription,
        feedback: parsedFeedback, // Use the cleaned data
      };

      await kv.set(`resume:${uuid}`, JSON.stringify(data));

      setStatusText("Success! Redirecting...");
      navigate(`/resume/${uuid}`);
    } catch (err) {
      console.error("Critical Error:", err);
      setStatusText(
        `Error: ${err instanceof Error ? err.message : "Something went wrong"}`,
      );
      setIsProcessing(false);
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    if (file)
      handleAnalyze({
        companyName: formData.get("company-name"),
        jobTitle: formData.get("job-title"),
        jobDescription: formData.get("job-description"),
        file,
      });
  };

  return (
    <main className="bg-[url('/images/bg-main.svg')] bg-cover min-h-screen">
      <Navbar />
      <section className='main-section'>
        <div className='page-heading py-16'>
          <h1>Smart feedback for your dream job</h1>
          {isProcessing ? (
            <div className='flex flex-col items-center gap-4'>
              <h2>{statusText}</h2>
              <img
                src='/images/resume-scan.gif'
                className='w-full max-w-md mx-auto'
                alt='Processing...'
              />
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              className='flex flex-col gap-4 mt-8 max-w-xl mx-auto'
            >
              <div className='form-div'>
                <label>Company Name</label>
                <input
                  type='text'
                  name='company-name'
                  placeholder='Google'
                  required
                />
              </div>
              <div className='form-div'>
                <label>Job Title</label>
                <input
                  type='text'
                  name='job-title'
                  placeholder='Frontend Developer'
                  required
                />
              </div>
              <div className='form-div'>
                <label>Job Description</label>
                <textarea
                  rows={5}
                  name='job-description'
                  placeholder='Paste requirements here...'
                />
              </div>
              <div className='form-div'>
                <label>Resume (PDF)</label>
                <FileUploader onFileSelect={setFile} />
              </div>
              <button
                className='primary-button mt-4'
                type='submit'
                disabled={!file}
              >
                Analyze Resume
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
};

export default Upload;
