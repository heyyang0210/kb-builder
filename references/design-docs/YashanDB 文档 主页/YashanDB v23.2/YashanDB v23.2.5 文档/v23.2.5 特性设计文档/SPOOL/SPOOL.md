Created by 冯皓博, last modified on 七月 30, 2024

# SQLPLUS调研：

  [https://docs.oracle.com/en/database/oracle/oracle-database/23/sqpug/SPOOL.html](https://docs.oracle.com/en/database/oracle/oracle-database/23/sqpug/SPOOL.html)  

在 Oracle 数据库中，    `spool`       是 SQL  *Plus 工具的一个命令，用于将 SQL*  Plus 会话中的输出内容保存到文件中。    `spool`       命令的基本语法如下：

  


```
spool filename
```

  


其中，    `filename`       是要保存输出内容的文件名。要开始保存输出内容到文件中，可以在 SQL*Plus 会话中输入       `spool filename`    ，接着执行 SQL 查询或其他命令，所有输出的结果都会被保存到指定的文件中。要停止保存输出内容到文件中，可以输入       `spool off`       命令。

下面是一个简单的示例，演示了如何使用       `spool`       命令将查询结果保存到文件中：

  


```
SQL> spool employees.txt 
SQL> select * from employees; 
SQL> spool off
```

  ` `  

在上面的示例中，查询结果将会保存到名为       `employees.txt`       的文件中。    
    


# 设计：

### 1、语法

```
SPO[OLOUT] [file_name[.ext] [CRE[ATE] | REP[LACE] | APP[END]] | OFF | OUT]
```

### 2、细节

#### spool相关：

支持spo、spoo、spool

#### file_name相关：

file_name带后缀：

创建对应后缀的文件

file_name不带后缀：

创建对应文件名+默认后缀名的文件（默认后缀名：win：LST（大写）   linux：lst（小写））

PS：  扩展名不会附加到 /dev/null 和 /dev/stderr 等系统文件

#### [CRE[ATE] | REP[LACE] | APP[END]]相关：

默认值：  REP[LACE]

|项|说明|
|---|---|
|CRE[ATE]|**当文件存在：**,SP2-0771: File "1.lst" already exists.    
  Use another name or "SPOOL filename[.ext] REPLACE",**当文件不存在：**,创建文件并从头写入|
|REP[LACE]|**当文件存在：**,覆盖文件并从头写入,**当文件不存在：**,创建文件并从头写入|
|APP[END]|**当文件存在：**,从尾部追加写入,**当文件不存在：**,创建文件并从头写入|


#### OFF相关：

停止写入并关闭文件描述符

#### OUT相关：

暂不支持

#### 其他：

当打开spool文件后再打开，那每次相当于打开一次

比如先create，后replace，那replace就会把前边文件的内容清空

当指定的文件是一个目录时，最终目录会变为：目录/.lst

## Attachments:

[image2024-7-26_10-24-20.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZkZDlhMWFkOWEzMzExZGM5M2VlIiwicmVmX2lkIjoiNjczOTZkZDk3MjgyMDZlZmI5MmYyM2UyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMzEyNDQ2LCJleHAiOjE3ODIzOTg4NDZ9.CFAH280j6VZjmHKPC8sJZ0XLty2tYzm7b6pX9Et8PB8)

 (image/png)    


## Comments:

|  [](null)  ,1、以下情况适配,spool 1.txt create/replace/append,select 1 form dual;,spool 2.txt append,2、  You must use quotes around file names containing white space.,3、非法filename输入的表现，无校验filename是否合法的逻辑，只是看能否fopen,4、相对路径：path、./、../,  
,Posted by fenghaobo at 七月 30, 2024 11:15|
|---|
