// Rich Document Templates for Word Studio

export const DOCUMENT_TEMPLATES = [
  {
    id: 'welcome-workspace',
    name: 'Workspace Guide & Sample Doc',
    category: 'Starter',
    icon: 'fa-solid fa-wand-magic-sparkles',
    description: 'Interactive showcase of Word formatting, tables, checklists, and export features.',
    content: `
      <h1 style="color: #1e3a8a; border-bottom: 2px solid #2563eb; padding-bottom: 8px;">OmniWord Studio &amp; Productivity Hub</h1>
      <p style="font-size: 12pt; color: #475569;"><strong>Welcome to your unified Microsoft Word Processor, Actionable To-Do List, and Quick Notepad.</strong> Everything you write, plan, or sketch here is automatically saved and can be exported to <strong>Microsoft Word (.docx / .doc)</strong> and <strong>PDF (.pdf)</strong> with a single click.</p>
      
      <h2>1. Executive Summary &amp; Project Overview</h2>
      <p>Use the <strong>Ribbon Toolbar</strong> above just like Microsoft Word: switch between <em>Home</em>, <em>Insert</em>, <em>Design &amp; Layout</em>, and <em>View &amp; Review</em> tabs to customize fonts, paragraph spacing, page margins, orientation, watermarks, tables, callout boxes, and more.</p>
      
      <blockquote>
        "Productivity is never an accident. It is always the result of a commitment to excellence, intelligent planning, and focused effort." — Paul J. Meyer
      </blockquote>

      <h2>2. Key Milestones &amp; Deliverable Schedule</h2>
      <table>
        <thead>
          <tr>
            <th style="background-color: #dbeafe; color: #1e3a8a;">Phase</th>
            <th style="background-color: #dbeafe; color: #1e3a8a;">Deliverable</th>
            <th style="background-color: #dbeafe; color: #1e3a8a;">Owner</th>
            <th style="background-color: #dbeafe; color: #1e3a8a;">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Phase 1</strong></td>
            <td>System Architecture &amp; UI Design</td>
            <td>Product Team</td>
            <td><span style="background-color: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 4px; font-weight: 600;">Completed</span></td>
          </tr>
          <tr>
            <td><strong>Phase 2</strong></td>
            <td>Rich Word Editor &amp; Multi-Tab Ribbon</td>
            <td>Core Engineering</td>
            <td><span style="background-color: #dcfce7; color: #166534; padding: 2px 8px; font-weight: 600; border-radius: 4px;">Completed</span></td>
          </tr>
          <tr>
            <td><strong>Phase 3</strong></td>
            <td>DOCX &amp; PDF High-Fidelity Export Engine</td>
            <td>Document Systems</td>
            <td><span style="background-color: #fef3c7; color: #92400e; padding: 2px 8px; font-weight: 600; border-radius: 4px;">In Review</span></td>
          </tr>
        </tbody>
      </table>

      <h2>3. Embedded Action Checklist</h2>
      <p>You can manage tasks in the dedicated <strong>To-Do Manager</strong> tab or embed interactive checklists directly inside any Word document:</p>
      <ul style="list-style-type: none; padding-left: 4px;">
        <li style="margin-bottom: 6px;"><input type="checkbox" checked="checked" /> Finalize Q4 strategic roadmap document in Word Studio</li>
        <li style="margin-bottom: 6px;"><input type="checkbox" checked="checked" /> Sync high-priority tasks from the To-Do sidebar into the executive report</li>
        <li style="margin-bottom: 6px;"><input type="checkbox" /> Export final deliverable as both <strong>.DOCX</strong> and <strong>.PDF</strong> for stakeholders</li>
      </ul>

      <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 12px 16px; border-radius: 6px; margin: 16px 0;">
        <strong style="color: #1d4ed8;">💡 Pro Tip:</strong> Use the right-hand <strong>Productivity Dock</strong> to jot down quick ideas in your <em>Notepad</em> or check off items in your <em>To-Do List</em> without ever leaving your document—or click <strong>"Insert Tasks into Doc"</strong> to drop your live task table right at your cursor!
      </div>
    `,
  },
  {
    id: 'blank',
    name: 'Blank Document',
    category: 'General',
    icon: 'fa-regular fa-file',
    description: 'Start fresh with a clean, standard A4/Letter Word document.',
    content: `<p>Start typing your document here...</p>`,
  },
  {
    id: 'project-proposal',
    name: 'Project Proposal',
    category: 'Business',
    icon: 'fa-solid fa-briefcase',
    description: 'Structured business proposal with objectives, scope, budget table, and sign-off.',
    content: `
      <h1 style="text-align: center; color: #0f172a; font-size: 24pt;">STRATEGIC PROJECT PROPOSAL</h1>
      <p style="text-align: center; color: #64748b; font-size: 11pt;">Prepared by: [Your Name / Organization] &bull; Date: ${new Date().toLocaleDateString()}</p>
      <hr />
      <h2>1. Problem Statement &amp; Objective</h2>
      <p>Describe the core opportunity or business challenge this initiative addresses. Outline measurable goals and target outcomes for the upcoming quarter.</p>
      <h2>2. Scope of Work</h2>
      <ul>
        <li><strong>Discovery &amp; Research:</strong> Stakeholder interviews, competitive benchmarking, and technical audit.</li>
        <li><strong>Implementation:</strong> Core platform development, QA testing, and staging deployment.</li>
        <li><strong>Launch &amp; Rollout:</strong> Documentation, team training, and post-launch monitoring.</li>
      </ul>
      <h2>3. Estimated Budget &amp; Resource Allocation</h2>
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th>Description</th>
            <th>Timeline</th>
            <th>Estimated Cost</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Research &amp; Design</td>
            <td>UX/UI wireframes, user testing, design system</td>
            <td>3 Weeks</td>
            <td>$4,500</td>
          </tr>
          <tr>
            <td>Engineering</td>
            <td>Frontend, backend APIs, export integration</td>
            <td>6 Weeks</td>
            <td>$12,000</td>
          </tr>
          <tr>
            <td>Quality Assurance</td>
            <td>Automated testing &amp; security review</td>
            <td>2 Weeks</td>
            <td>$2,500</td>
          </tr>
        </tbody>
      </table>
      <h2>4. Approval &amp; Sign-Off</h2>
      <p style="margin-top: 28px;"><strong>Approved By:</strong> ___________________________ &nbsp;&nbsp;&nbsp;&nbsp; <strong>Date:</strong> _______________</p>
    `,
  },
  {
    id: 'meeting-notes',
    name: 'Meeting Minutes & Action Plan',
    category: 'Productivity',
    icon: 'fa-solid fa-users-rectangle',
    description: 'Capture attendees, agenda items, key decisions, and assigned action items.',
    content: `
      <h1 style="color: #1e40af;">Meeting Minutes &amp; Action Plan</h1>
      <p><strong>Date:</strong> ${new Date().toLocaleDateString()} &nbsp;|&nbsp; <strong>Time:</strong> 10:00 AM &nbsp;|&nbsp; <strong>Location:</strong> Conference Room A / Virtual</p>
      <p><strong>Attendees:</strong> Alex Morgan, Priya Nair, David Kim, Sarah Jenkins</p>
      <hr />
      <h2>1. Agenda Topics</h2>
      <ol>
        <li>Review previous sprint velocity and completed tasks</li>
        <li>Discuss upcoming product release milestones</li>
        <li>Assign action items and deadlines</li>
      </ol>
      <h2>2. Key Discussion Points &amp; Decisions</h2>
      <p>The team agreed to prioritize the Microsoft Word and PDF export workflows and integrate the live To-Do List and Notepad side-by-side with the main document editor.</p>
      <h2>3. Action Items</h2>
      <table>
        <thead>
          <tr>
            <th>Done</th>
            <th>Action Item</th>
            <th>Assignee</th>
            <th>Due Date</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="text-align: center;">☐</td>
            <td>Prepare final specification deck</td>
            <td>Alex Morgan</td>
            <td>Friday</td>
          </tr>
          <tr>
            <td style="text-align: center;">☐</td>
            <td>Verify PDF &amp; DOCX formatting across devices</td>
            <td>Priya Nair</td>
            <td>Monday</td>
          </tr>
        </tbody>
      </table>
    `,
  },
  {
    id: 'modern-resume',
    name: 'Executive Resume / CV',
    category: 'Personal',
    icon: 'fa-solid fa-id-card',
    description: 'Clean, ATS-friendly professional resume layout ready for Word and PDF export.',
    content: `
      <h1 style="text-align: center; margin-bottom: 2px; color: #0f172a;">ALEXANDER MORGAN</h1>
      <p style="text-align: center; color: #475569; font-size: 10.5pt;">San Francisco, CA &bull; alex.morgan@email.com &bull; (555) 234-5678 &bull; linkedin.com/in/alexmorgan</p>
      <hr />
      <h2>PROFESSIONAL SUMMARY</h2>
      <p>Results-driven Full-Stack Software Engineer with 5+ years of experience designing high-performance web applications, document processing engines, and intuitive user interfaces.</p>
      <h2>WORK EXPERIENCE</h2>
      <p><strong>Senior Frontend Engineer — TechNova Solutions</strong> <em>(2023 – Present)</em></p>
      <ul>
        <li>Architected a browser-based rich document suite supporting real-time DOCX and PDF generation for 150K+ monthly active users.</li>
        <li>Reduced bundle load time by 42% and improved accessibility compliance to WCAG 2.1 AA standards.</li>
      </ul>
      <p><strong>Software Developer — CloudScale Labs</strong> <em>(2020 – 2023)</em></p>
      <ul>
        <li>Built collaborative task management and note-taking workflows using React, TypeScript, and modern state persistence.</li>
      </ul>
      <h2>EDUCATION &amp; SKILLS</h2>
      <p><strong>B.S. in Computer Science</strong> — University of California</p>
      <p><strong>Core Competencies:</strong> React, JavaScript/TypeScript, HTML5/CSS3, Node.js, UI/UX Architecture, Document Systems</p>
    `,
  },
  {
    id: 'academic-paper',
    name: 'Academic Research Paper',
    category: 'Education',
    icon: 'fa-solid fa-graduation-cap',
    description: 'Formal academic paper layout with abstract, sections, citations, and references.',
    content: `
      <h1 style="text-align: center; font-family: 'Times New Roman', serif; font-size: 20pt; color: #000000;">Modern Web-Based Document Processing and Task Synthesis</h1>
      <p style="text-align: center; font-family: 'Times New Roman', serif; font-style: italic;">Department of Computer Science &amp; Engineering</p>
      <div style="margin: 16px 32px; padding: 12px; background-color: #f8fafc; border: 1px solid #cbd5e1;">
        <strong>Abstract—</strong> This paper explores the convergence of structured task management, rapid note capture, and WYSIWYG word processing within a unified browser environment, enabling seamless cross-format export to OpenXML (.docx) and Portable Document Format (.pdf).
      </div>
      <h2 style="font-family: 'Times New Roman', serif; color: #000000;">I. Introduction</h2>
      <p style="font-family: 'Times New Roman', serif; text-align: justify;">Traditional workflows fragment ideation (notepads), execution tracking (to-do lists), and formal documentation (word processors) across disparate applications. Unifying these paradigms reduces cognitive switching costs.</p>
      <h2 style="font-family: 'Times New Roman', serif; color: #000000;">II. Methodology &amp; Architecture</h2>
      <p style="font-family: 'Times New Roman', serif; text-align: justify;">By combining an interactive Rich Text DOM canvas with structured state persistence and client-side OpenXML packaging, users can transition effortlessly from bulleted action items to publication-ready manuscripts.</p>
      <h2 style="font-family: 'Times New Roman', serif; color: #000000;">III. References</h2>
      <ol style="font-family: 'Times New Roman', serif; font-size: 10pt;">
        <li>ECMA-376, "Office Open XML File Formats," Ecma International, 5th Edition.</li>
        <li>ISO 32000-2, "Document management — Portable document format," International Organization for Standardization.</li>
      </ol>
    `,
  },
];
