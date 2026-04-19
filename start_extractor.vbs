Set WshShell = CreateObject("WScript.Shell")
Set WshEnv = WshShell.Environment("Process")
WshEnv("PATH") = WshEnv("PATH") & ";" & WshShell.ExpandEnvironmentStrings("%USERPROFILE%") & "\.deno\bin"
WshShell.CurrentDirectory = "C:\Users\Juli\piano-learn"
WshShell.Run "C:\Users\Juli\piano-learn\.venv-extractor\Scripts\pythonw.exe C:\Users\Juli\piano-learn\run_extractor.py", 0, False
