// app/routes/upload.tsx
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
  }: {
    companyName: string;
    jobTitle: string;
    jobDescription: string;
    file: File;
  }) => {
    setIsProcessing(true);

    try {
      setStatusText("Uploading the file...");
      // Puter returns an array; grab the first item
      const uploadResults = await fs.upload([file]);
      const uploadedFile = Array.isArray(uploadResults)
        ? uploadResults[0]
        : uploadResults;
      if (!uploadedFile?.path) throw new Error("Failed to get upload path");

      setStatusText("Converting to image...");
      const imageFile = await convertPdfToImage(file);
      if (imageFile.error || !imageFile.file) {
        throw new Error(imageFile.error || "Failed to convert PDF to image");
      }

      setStatusText("Uploading the image...");
      const imageUploadResults = await fs.upload([imageFile.file]);
      const uploadedImage = Array.isArray(imageUploadResults)
        ? imageUploadResults[0]
        : imageUploadResults;
      if (!uploadedImage?.path) throw new Error("Failed to upload image");

      setStatusText("Preparing data...");
      const uuid = generateUUID();
      const data = {
        id: uuid,
        resumePath: uploadedFile.path,
        imagePath: uploadedImage.path,
        companyName,
        jobTitle,
        jobDescription,
        feedback: null, // Initialize as null
      };

      setStatusText("Analyzing...");
      const feedback = await ai.feedback(
        uploadedFile.path,
        prepareInstructions({ jobTitle, jobDescription }),
      );

      if (!feedback) throw new Error("AI returned no results");

      const feedbackText =
        typeof feedback.message.content === "string"
          ? feedback.message.content
          : feedback.message.content[0].text;

      data.feedback = JSON.parse(feedbackText);

      // Save full data with feedback to KV
      await kv.set(`resume:${uuid}`, JSON.stringify(data));

      setStatusText("Complete! Redirecting...");
      navigate(`/resume/${uuid}`);
    } catch (err) {
      console.error("Analysis Error:", err);
      setStatusText(
        `Error: ${err instanceof Error ? err.message : String(err)}`,
      );
      setIsProcessing(false);
    }
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const companyName = formData.get("company-name") as string;
    const jobTitle = formData.get("job-title") as string;
    const jobDescription = formData.get("job-description") as string;

    if (!file) return;
    handleAnalyze({ companyName, jobTitle, jobDescription, file });
  };

  return (
    <main className="bg-[url('/images/bg-main.svg')] bg-cover">
      <Navbar />
      <section className='main-section'>
        <div className='page-heading py-16'>
          <h1>Smart feedback for your dream job</h1>
          {isProcessing ? (
            <>
              <h2>{statusText}</h2>
              <img
                src='/images/resume-scan.gif'
                className='w-full'
                alt='Scanning...'
              />
            </>
          ) : (
            <>
              <h2>Drop your resume for an ATS score and improvement tips</h2>
              <form
                id='upload-form'
                onSubmit={handleSubmit}
                className='flex flex-col gap-4 mt-8'
              >
                <div className='form-div'>
                  <label htmlFor='company-name'>Company Name</label>
                  <input
                    type='text'
                    name='company-name'
                    placeholder='Google'
                    id='company-name'
                    required
                  />
                </div>
                <div className='form-div'>
                  <label htmlFor='job-title'>Job Title</label>
                  <input
                    type='text'
                    name='job-title'
                    placeholder='Frontend Developer'
                    id='job-title'
                    required
                  />
                </div>
                <div className='form-div'>
                  <label htmlFor='job-description'>Job Description</label>
                  <textarea
                    rows={5}
                    name='job-description'
                    placeholder='Paste job details here...'
                    id='job-description'
                  />
                </div>
                <div className='form-div'>
                  <label htmlFor='uploader'>Upload Resume</label>
                  <FileUploader onFileSelect={setFile} />
                </div>
                <button
                  className='primary-button'
                  type='submit'
                  disabled={!file}
                >
                  Analyze Resume
                </button>
              </form>
            </>
          )}
        </div>
      </section>
    </main>
  );
};
export default Upload;
