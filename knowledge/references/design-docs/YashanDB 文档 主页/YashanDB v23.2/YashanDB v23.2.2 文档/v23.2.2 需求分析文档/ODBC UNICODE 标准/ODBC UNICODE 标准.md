Created by 冯皓博, last modified on 三月 08, 2024

  [https://www.progress.com/tutorials/odbc/unicode](https://www.progress.com/tutorials/odbc/unicode)  

  


ANSI字符集如何确定：

驱动程序管理器通过引用代码页来确定它必须转换到的 ANSI 编码系统。在 Windows 上，此引用是指活动代码页。在 UNIX 和 Linux 上，它是 IANAAppCodePage 连接字符串属性，是 odbc.ini 文件的一部分。

  


### WINDOWS：

UNICODE指UTF16

|驱动程序|应用程序|说明|备注|
|---|---|---|---|
|ANSI|ANSI|正常|  
|
|ANSI|UNICODE|连不上|![](https://pingcode.yasdb.com/atlas/files/public/67396cc3a1ad9a3311dc8ca4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQ0FBQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDM3NzEsImV4cCI6MTc4MjMxNDU3MX0.bUfNR5z3oDcP5tAFrKIJUa5of-_ykx3Edvlw-5cG6Zc)|
|UNICODE|UNICODE|  
|  
|


### LINUX：

UNICODE指UTF8

  


# TODO：

- [x] WINDOWS处理ANSI字符集（getACP）   

- [x] LINUX支持自定义字符集（odbc.ini数据源配置）   

- [ ] 查看数据源字符集和UNICODE的关系   

- [ ] linux UNICODE使用UTF8还是UTF16   

- [ ] MYSQL、PLOARDB为何ANSI和UNICODE驱动分开？   

  


## Attachments: