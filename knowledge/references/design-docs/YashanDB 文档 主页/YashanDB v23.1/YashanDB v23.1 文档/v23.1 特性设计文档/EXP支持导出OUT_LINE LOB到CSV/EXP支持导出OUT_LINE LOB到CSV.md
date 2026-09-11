Created by 侯忠林, last modified on 十二月 13, 2023

##   [1. Overview（概述）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#1-overview%E6%A6%82%E8%BF%B0)  

目前到出out line lob数据会导致导出的csv是文件特别巨大，导致在导入的时候还得对文件操作很慢。所以希望在导出lob的时候，将log数据单独放置到一个文件，在导入lob数据的时候将从单独的文件中读取lob数据。

  [[YDBRD-14165] EXP支持导出OUT_LINE LOB到CSV - SICS-CoD Jira (yasdb.com)](https://jira.yasdb.com/browse/YDBRD-14165)  

##   [2. Features（功能特性）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#2-features%E5%8A%9F%E8%83%BD%E7%89%B9%E6%80%A7)  

1 将lob数据单独放置在一个    [ext](http://filename.ext.nnn.mm/%EF%BC%8C%E5%85%B6%E4%B8%AD%E6%AF%8F%E4%B8%AA%E5%85%83%E7%B4%A0%E7%9A%84%E5%AE%9A%E4%B9%89%E5%A6%82%E4%B8%8B%EF%BC%9A)    结尾的一个文件中，源文件记录lob存放的文件信息和位置信息

2 每一个表，每一个lob列一个单独的文件。

3 每一个lob一个单独的文件

##   [3. Interfaces（接口）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#3-interfaces%E6%8E%A5%E5%8F%A3)  

无

##   [4. Limitations（功能限制）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#4-limitations%E5%8A%9F%E8%83%BD%E9%99%90%E5%88%B6)  

每一列的lob一个文件，同样会出现一个lob文件特别大的情况。

此次只是先lls的格式。

##   [5. Detail Design（详细设计）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#5-detail-design%E8%AF%A6%E7%BB%86%E8%AE%BE%E8%AE%A1)  

### 增加参数lob

lob = file ,lob = lls或者csv

lob 目前只支持lls和csv，大小写都可。如果配置参数则必须有值，不配置参数默认lls形式。

### **lob = lls**

LOB location Specifier（LLS）LOB位置指定器，在数据写入csv文件的时候，如果是lob，则将数据写入特定的    [ext](http://filename.ext.nnn.mm/%EF%BC%8C%E5%85%B6%E4%B8%AD%E6%AF%8F%E4%B8%AA%E5%85%83%E7%B4%A0%E7%9A%84%E5%AE%9A%E4%B9%89%E5%A6%82%E4%B8%8B%EF%BC%9A)    文件，并在原来的csv文件中记录文件的名称，偏移位置和数据长度。每一个表，每一个lob列一个单独的ext文件。

格式：

  [filename.ext.nnn.mm/，](http://filename.ext.nnn.mm/，)  

其中每个元素的定义如下：

filename.ext是包含LOB的文件的名称。

nnn是文件中LOB的偏移量，以字节为单位。

mmm是LOB的长度，字节数。值为-1表示LOB为NULL。值为0意味着LOB存在，但为空。

正斜线（/）是字段的结束语

![](https://conf.yasdb.com/download/attachments/72803733/image2022-4-15_10-30-53.png?version=1&modificationDate=1649989634000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyMTE1NzMsImV4cCI6MTc4MjIyMjM3M30.gm7bjMlwCrIVQNmnZNOKBL6DYecRWEHzijl8k949SMI)

1 每一个lob信息记录自己lob的stream流信息，流和普通的导入导出共用一个buff

2 在lob开始写入数据的时候，如果有数据则先进行一次flush，将现有数据进行一次落盘

3 lob数据写入的时候如果写满了，则flush进行落盘，如果lob写完的时候进行一次落盘，保障下一次写入的时候已经将lob数据写完了。

4 写完的lob数据落盘后，将文件的offset更新。

5 每次在数据写入的时候，增加对写入文件线程的，流的检测，如果不是当前流则进行切换，保证监听的线程一定监听的是当前流。

6 filename为表名加列名

### **lob = file**

LobFile，文件模式，每一行创建一个文件夹，每一个lob一个dat文件，并在原文件的地方记录文件的文件夹和文件名

格式：

文件夹/filename.dat

例如

LOB0000/00000000_0001.dat

如果lob为null或者长度为0则没有lob文件，源文件位置为空。

##   [6. Testcases（自测用例）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#6-testcases%E8%87%AA%E6%B5%8B%E7%94%A8%E4%BE%8B)  

1.out line lob的多行导出

2 每行多lob列的导出

3 in line lob的导出

4 多表多行导出

5 导出数据支持导入

6 其中一个lob文件落盘失败，其他文件要全部清掉

##   [7. Workload（工作量）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#7-workload%E5%B7%A5%E4%BD%9C%E9%87%8F)  

*评估代码量KLOC、工作量（人天）。*

代码300+行，工作量7天。

##   [8. TODO（遗留问题）](http://cod-conf.sics.com/pages/viewpage.action?pageId=11698367#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*

无