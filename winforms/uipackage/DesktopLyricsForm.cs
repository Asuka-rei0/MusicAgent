using System.Drawing.Drawing2D;

namespace MusicAgentWinForms;

public sealed class DesktopLyricsForm : Form
{
    private static readonly Color TransparentColor = Color.FromArgb(1, 2, 3);
    private const int WsExTopmost = 0x00000008;
    private const int WsExToolWindow = 0x00000080;
    private const int WsExNoActivate = 0x08000000;

    private readonly Form ownerForm;
    private readonly Label lyricLabel;
    private readonly Button closeButton;
    private readonly System.Windows.Forms.Timer hoverTimer;
    private bool hasManualPosition;
    private bool isHovered;
    private bool isDragging;
    private Point dragStartCursor;
    private Point dragStartLocation;

    public event EventHandler? CloseRequested;

    public DesktopLyricsForm(Form ownerForm)
    {
        this.ownerForm = ownerForm;

        FormBorderStyle = FormBorderStyle.None;
        ShowInTaskbar = false;
        TopMost = true;
        StartPosition = FormStartPosition.Manual;
        BackColor = TransparentColor;
        TransparencyKey = TransparentColor;
        ForeColor = Color.White;
        Width = 920;
        Height = 76;
        Padding = new Padding(52, 8, 52, 8);
        DoubleBuffered = true;

        lyricLabel = new Label
        {
            Dock = DockStyle.Fill,
            AutoEllipsis = true,
            BackColor = Color.Transparent,
            Font = new Font("Microsoft YaHei UI", 24f, FontStyle.Bold),
            ForeColor = Color.FromArgb(248, 238, 255),
            TextAlign = ContentAlignment.MiddleCenter,
            UseMnemonic = false
        };

        closeButton = new Button
        {
            Anchor = AnchorStyles.Top | AnchorStyles.Right,
            BackColor = Color.FromArgb(70, 255, 255, 255),
            FlatStyle = FlatStyle.Flat,
            ForeColor = Color.FromArgb(235, 238, 246),
            Font = new Font("Segoe UI", 10f, FontStyle.Bold),
            Size = new Size(28, 28),
            Text = "x",
            TabStop = false,
            Visible = false
        };
        closeButton.FlatAppearance.BorderSize = 0;
        closeButton.FlatAppearance.MouseOverBackColor = Color.FromArgb(105, 255, 255, 255);
        closeButton.FlatAppearance.MouseDownBackColor = Color.FromArgb(135, 255, 255, 255);
        closeButton.Click += (_, _) => CloseRequested?.Invoke(this, EventArgs.Empty);

        Controls.Add(lyricLabel);
        Controls.Add(closeButton);
        PositionCloseButton();

        hoverTimer = new System.Windows.Forms.Timer { Interval = 120 };
        hoverTimer.Tick += (_, _) =>
        {
            if (!Bounds.Contains(Cursor.Position))
            {
                SetHoverState(false);
            }
        };

        RegisterPointerHandlers(this);
        RegisterPointerHandlers(lyricLabel);
        RegisterPointerHandlers(closeButton);
        PositionNearOwnerTop();
    }

    protected override bool ShowWithoutActivation => true;

    protected override CreateParams CreateParams
    {
        get
        {
            var createParams = base.CreateParams;
            createParams.ExStyle |= WsExTopmost | WsExToolWindow | WsExNoActivate;
            return createParams;
        }
    }

    protected override void OnResize(EventArgs e)
    {
        base.OnResize(e);
        PositionCloseButton();
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        base.OnPaint(e);
        if (!isHovered) return;

        e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        using var path = CreateRoundedRectPath(new Rectangle(0, 0, Width - 1, Height - 1), 16);
        using var fill = new SolidBrush(Color.FromArgb(92, 18, 18, 28));
        using var border = new Pen(Color.FromArgb(70, 255, 255, 255), 1);
        e.Graphics.FillPath(fill, path);
        e.Graphics.DrawPath(border, path);
    }

    public void ShowLyrics()
    {
        try
        {
            if (!hasManualPosition)
            {
                PositionNearOwnerTop();
            }

            if (!Visible && ownerForm != null && !ownerForm.IsDisposed)
            {
                Show(ownerForm);
            }
            else if (!Visible)
            {
                Show();
            }

            TopMost = false;
            TopMost = true;
            BringToFront();
            Invalidate();
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"显示桌面歌词窗体失败: {ex.Message}");
            throw;
        }
    }

    public void UpdateLyrics(DesktopLyricsPayload payload)
    {
        try
        {
            if (InvokeRequired)
            {
                BeginInvoke(new Action(() => UpdateLyrics(payload)));
                return;
            }

            if (lyricLabel != null && !lyricLabel.IsDisposed)
            {
                lyricLabel.Text = BuildLyricText(payload);
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"更新桌面歌词文本失败: {ex.Message}");
        }
    }

    private static string BuildLyricText(DesktopLyricsPayload payload)
    {
        var lyric = payload.Lyric?.Trim() ?? string.Empty;
        if (!string.IsNullOrWhiteSpace(lyric))
        {
            return lyric;
        }

        return string.IsNullOrWhiteSpace(payload.Title)
            ? "\u7b49\u5f85\u64ad\u653e\u97f3\u4e50"
            : "\u6682\u65e0\u6b4c\u8bcd";
    }

    private void RegisterPointerHandlers(Control control)
    {
        control.MouseEnter += (_, _) => SetHoverState(true);
        control.MouseDown += HandleMouseDown;
        control.MouseMove += HandleMouseMove;
        control.MouseUp += HandleMouseUp;
    }

    private void PositionCloseButton()
    {
        if (closeButton == null || closeButton.IsDisposed) return;

        closeButton.Location = new Point(ClientSize.Width - closeButton.Width - 12, 10);
    }

    private void HandleMouseDown(object? sender, MouseEventArgs e)
    {
        if (e.Button != MouseButtons.Left || sender == closeButton) return;

        isDragging = true;
        Capture = true;
        dragStartCursor = Cursor.Position;
        dragStartLocation = Location;
        SetHoverState(true);
    }

    private void HandleMouseMove(object? sender, MouseEventArgs e)
    {
        if (!isDragging) return;

        var currentCursor = Cursor.Position;
        Location = new Point(
            dragStartLocation.X + currentCursor.X - dragStartCursor.X,
            dragStartLocation.Y + currentCursor.Y - dragStartCursor.Y);
        hasManualPosition = true;
    }

    private void HandleMouseUp(object? sender, MouseEventArgs e)
    {
        if (e.Button != MouseButtons.Left) return;

        isDragging = false;
        Capture = false;
    }

    private void SetHoverState(bool hovered)
    {
        if (isHovered == hovered) return;

        isHovered = hovered;
        if (closeButton != null && !closeButton.IsDisposed)
        {
            closeButton.Visible = hovered;
        }
        if (hovered)
        {
            hoverTimer.Start();
        }
        else
        {
            hoverTimer.Stop();
        }
        Invalidate();
    }

    private void PositionNearOwnerTop()
    {
        try
        {
            if (ownerForm == null || ownerForm.IsDisposed) return;

            var ownerBounds = ownerForm.WindowState == FormWindowState.Minimized
                ? ownerForm.RestoreBounds
                : ownerForm.Bounds;

            var screen = Screen.FromControl(ownerForm);
            if (screen == null) return;

            var workingArea = screen.WorkingArea;
            var targetLeft = ownerBounds.Left + Math.Max(0, (ownerBounds.Width - Width) / 2);
            var targetTop = ownerBounds.Top + 18;

            Left = Math.Min(Math.Max(workingArea.Left + 8, targetLeft), workingArea.Right - Width - 8);
            Top = Math.Min(Math.Max(workingArea.Top + 8, targetTop), workingArea.Bottom - Height - 8);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"定位桌面歌词窗体失败: {ex.Message}");
            if (ownerForm != null && !ownerForm.IsDisposed)
            {
                try
                {
                    Left = ownerForm.Left + (ownerForm.Width - Width) / 2;
                    Top = ownerForm.Top + 18;
                }
                catch
                {
                    Left = 100;
                    Top = 100;
                }
            }
            else
            {
                Left = 100;
                Top = 100;
            }
        }
    }

    private static GraphicsPath CreateRoundedRectPath(Rectangle bounds, int radius)
    {
        var path = new GraphicsPath();
        var diameter = radius * 2;
        var arc = new Rectangle(bounds.Location, new Size(diameter, diameter));

        path.AddArc(arc, 180, 90);
        arc.X = bounds.Right - diameter;
        path.AddArc(arc, 270, 90);
        arc.Y = bounds.Bottom - diameter;
        path.AddArc(arc, 0, 90);
        arc.X = bounds.Left;
        path.AddArc(arc, 90, 90);
        path.CloseFigure();
        return path;
    }
}

public sealed class DesktopLyricsPayload
{
    public bool Enabled { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Artist { get; set; } = string.Empty;
    public string Lyric { get; set; } = string.Empty;
    public string NextLyric { get; set; } = string.Empty;
    public bool IsPlaying { get; set; }
    public string ProgressText { get; set; } = string.Empty;
}
