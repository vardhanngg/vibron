const fs = require("fs").promises;
const path = require("path");

module.exports = async function handler(req, res) {
  try {
    const feedbackFile = path.resolve("./feedback.json");

    if (req.method === "POST") {
      const { feedback, username } = req.body || {};
      if (!feedback || feedback.trim() === "") {
        return res.status(400).json({ error: "Feedback cannot be empty" });
      }

      let allFeedback = [];
      try {
        const data = await fs.readFile(feedbackFile, "utf-8");
        allFeedback = JSON.parse(data || "[]");
      } catch {
        allFeedback = [];
      }

      allFeedback.push({
        username: username || "Anonymous",
        feedback: feedback.trim(),
        date: new Date().toISOString(),
      });

      await fs.writeFile(feedbackFile, JSON.stringify(allFeedback, null, 2));

      console.log("✅ Feedback saved!");
      return res.status(200).json({ success: true });
    }

    if (req.method === "GET") {
      try {
        const data = await fs.readFile(feedbackFile, "utf-8");
        return res.status(200).json(JSON.parse(data || "[]"));
      } catch {
        return res.status(200).json([]);
      }
    }

    res.setHeader("Allow", ["GET", "POST"]);
    res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (err) {
    console.error("❌ Feedback API error:", err);
    res.status(500).json({ error: "Internal server error" });
  }
};
