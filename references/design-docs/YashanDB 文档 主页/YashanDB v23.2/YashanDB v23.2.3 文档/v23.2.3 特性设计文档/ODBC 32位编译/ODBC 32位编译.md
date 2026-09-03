Created by 冯皓博, last modified on 五月 30, 2024

#### ODBC:

in win32:    
  SQLLEN->long->32bit    
  SQLULEN->unsigned long->32bit    
  in win64:    
  SQLLEN->signed __int64->64bit    
  SQLULEN->unsigned __int64->64bit

#### 编译器：

32位平台    
  long 4个字节    
  指针 4个字节    
  64位平台    
  long 8个字节（区别）（4 in MSVC）    
  指针 8个字节（区别）

### 1、ssl+crypto三方库上传cpm（done）

  [https://conf.yasdb.com/x/bIDYB](https://conf.yasdb.com/x/bIDYB)  

### 2、C驱动触发32位编译，提供编译脚本修改（原有C驱动编译依赖主仓编译，实际上是全量编译后拷贝，现在要实现部分编译）（done）

```
python build.py config -p 32
python build.py build -c
python build.py install -c
```

###   
  3、C驱动打包脚本整改（done）

包名类似：yashandb-client-23.2.3.1-133-gec66bb7d8f-windows-x86.zip

oracle无特殊包名：    [Instant Client for Windows 32-bit | Oracle 中国](https://www.oracle.com/cn/database/technologies/instant-client/microsoft-windows-32-downloads.html)  

```
python build.py package -m client
```

![](https://pingcode.yasdb.com/atlas/files/public/67396d38a1ad9a3311dc8fa9/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBZ0FBRUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFnQUFRQUFBQUFBQUFBQVFDQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFJQUFBSUFBQUFBQUFBZ0FnQUFRQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQ0FBQUFBQUFBQUFBQkFJQWdBQUFBQUFBQUFBQUFJQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY2MTcsImV4cCI6MTc4MjMxNzQxN30._vot8ysrWtttmk7ZBTYsdOVleuq8hswIwkpPX7SBpAE)

![](https://pingcode.yasdb.com/atlas/files/public/67396d38a1ad9a3311dc8fab/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBZ0FBRUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFnQUFRQUFBQUFBQUFBQVFDQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFJQUFBSUFBQUFBQUFBZ0FnQUFRQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQ0FBQUFBQUFBQUFBQkFJQWdBQUFBQUFBQUFBQUFJQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY2MTcsImV4cCI6MTc4MjMxNzQxN30._vot8ysrWtttmk7ZBTYsdOVleuq8hswIwkpPX7SBpAE)

![](https://pingcode.yasdb.com/atlas/files/public/67396d38a1ad9a3311dc8fac/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBZ0FBRUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFnQUFRQUFBQUFBQUFBQVFDQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFJQUFBSUFBQUFBQUFBZ0FnQUFRQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQ0FBQUFBQUFBQUFBQkFJQWdBQUFBQUFBQUFBQUFJQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY2MTcsImV4cCI6MTc4MjMxNzQxN30._vot8ysrWtttmk7ZBTYsdOVleuq8hswIwkpPX7SBpAE)

![](https://pingcode.yasdb.com/atlas/files/public/67396d388970c2af4f52113c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBZ0FBRUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFnQUFRQUFBQUFBQUFBQVFDQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBZ0FBQUFBQUFJQUFBSUFBQUFBQUFBZ0FnQUFRQUFBQUFBQUFBQUFBQUFBQUFRQUFBQUFBQ0FBQUFBQUFBQUFBQkFJQWdBQUFBQUFBQUFBQUFJQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDY2MTcsImV4cCI6MTc4MjMxNzQxN30._vot8ysrWtttmk7ZBTYsdOVleuq8hswIwkpPX7SBpAE)

###   
  4、C驱动32位开发用例执行提供脚本（done）

```
1、编译
cmake .  -A win32
MSBuild ./test/ci_c_driver/CDriverTest.sln
2、运行
.\bin\Debug\yactest.exe --ipport=192.168.146.128:1688
```

### 5、ODBC打包脚本整改，新增32位编译选项（done）

**windows：**

编译

```
cmake .  -A win32
MSBuild yasdb-odbc.sln
```

编译+打包

```
python install_release.py -p 32
```

**Linux：**

编译

```
cmake .
make
```

编译+打包

```
python3 install_release.py
```

### 6、ODBC32位开发用例执行提供脚本（done）

此处ODBC开发门禁需要做整改，将win->win改为win->linux+linux->linux

```
yasodbctest citest DRIVER=YashanDB\;SERVER=127.0.0.1\;PORT=1688\;UID=sys\;PWD=Cod-2022\;
yasodbcunicodetest DRIVER=YashanDB\;SERVER=127.0.0.1\;PORT=1688\;UID=sys\;PWD=Cod-2022\;
```

  


  


## Attachments:

## Comments:

|  [](null)  ,win32    
  cpm install -P -y -xplat win32    
  others    
  cpm install -P -y,cpm tag：    
  windows->win32,兼容：    
  CI：    
  0.1.6    
  0.1.7,Posted by fenghaobo at 五月 28, 2024 15:10|
|---|
