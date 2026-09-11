# 内幕文档

来源：https://pingcode.yasdb.com/wiki/spaces/YASSTORAGE/pages/SBlM3dKV
爬取时间：2026-07-23 18:10:30

---

【复杂DML优化】CREATE AS SELECT支持融合
维优组 -YashanDB 外场投入
python驱动在简单插入和读取场景下持平oracle
窗口函数性能优化
【TPCDS 专项】TPCDS Q59 不改写语句的性能与改写后语句性能存在 4s 性能差距
YashanDB存储引擎
页面
99+
何阳
主页
OKR
专项跟踪
团队管理
存储引擎
代码目录
体系架构
存储规格
年度总结
年度规划
技术积累
TPCC
专利
内存使用
内幕文档
各种指南
性能优化
软文
软著
问题定位
鲲鹏
AI
概念介绍
模块划分
技术规划
研发周报
能力提升
·
14
存储引擎
技术积累
内幕文档
编辑
标签
内幕文档
Created by 郭藏龙, last modified on 一月 04, 2023
﻿



﻿

模块

责任人

文档

PPT


1

buffer

郭藏龙

﻿


﻿



2

dc

同二鹏

﻿


﻿



3

persistence

郭藏龙

﻿


﻿



4

redo

马志宏

﻿


﻿



5

tablespace

郭藏龙

﻿


﻿



6

xact

苏凡

﻿


﻿



7

index

张锐

﻿


﻿



8

table

李燕琼

﻿


﻿



9

lob

张锐

﻿


﻿



10

ssm

李燕琼

﻿


﻿



11

segment

李燕琼

﻿


﻿



12

replication

马志宏

﻿


﻿



13

backup

马志宏

﻿


﻿



14

privillege

苏凡


﻿


﻿


15

spf

陈宜顺

﻿


﻿



16

coral/swd

谢锐

﻿


﻿



17

swf

汪鹏

﻿


﻿



18

coast

谢锐

﻿


﻿

﻿

﻿
Attachments:
﻿
﻿
索引内幕文档.docx
297.2 KB
﻿
 (application/vnd.openxmlformats-officedocument.wordprocessingml.document)
﻿
﻿
﻿
REDO内幕.docx
539.9 KB
﻿
 (application/vnd.openxmlformats-officedocument.wordprocessingml.document)
﻿
﻿
﻿
Replication内幕.docx
469.1 KB
﻿
 (application/vnd.openxmlformats-officedocument.wordprocessingml.document)
﻿
﻿
﻿
LSC表技术内幕.docx
76.9 KB
﻿
 (application/vnd.openxmlformats-officedocument.wordprocessingml.document)
﻿
﻿
﻿
YashanDB DSI(数据字典 && SEQUENCE.docx
357.1 KB
﻿
 (application/vnd.openxmlformats-officedocument.wordprocessingml.document)
﻿
﻿
﻿
备份恢复内幕.docx
262 KB
﻿
 (application/vnd.openxmlformats-officedocument.wordprocessingml.document)
﻿
﻿
﻿
YashanDB DSI_SEQUENCE.docx
121.8 KB
﻿
 (application/vnd.openxmlformats-officedocument.wordprocessingml.document)
﻿
﻿
﻿
YashanDB DSI_数据字典.docx
241 KB
﻿
 (application/vnd.openxmlformats-officedocument.wordprocessingml.document)
﻿
﻿
﻿
YashanDB DSI_数据字典.docx
241 KB
﻿
 (application/vnd.openxmlformats-officedocument.wordprocessingml.document)
﻿
﻿
﻿
YashanDB DSI_数据字典.docx
241 KB
﻿
 (application/vnd.openxmlformats-officedocument.wordprocessingml.document)
﻿
﻿
﻿
数据缓存区.docx
284.1 KB
﻿
 (application/vnd.openxmlformats-officedocument.wordprocessingml.document)
﻿
﻿
﻿
表空间.docx
177 KB
﻿
 (application/vnd.openxmlformats-officedocument.wordprocessingml.document)
﻿
﻿
﻿
持久化.docx
243.4 KB
﻿
 (application/vnd.openxmlformats-officedocument.wordprocessingml.document)
﻿
﻿
﻿
YashanDB Coast格式.docx
261.5 KB
﻿
 (application/vnd.openxmlformats-officedocument.wordprocessingml.document)
﻿
﻿
﻿
LOB内幕文档.docx
155.5 KB
﻿
 (application/vnd.openxmlformats-officedocument.wordprocessingml.document)
﻿
﻿
﻿
YashanDB-可变列式存储.docx
239.1 KB
﻿
 (application/vnd.openxmlformats-officedocument.wordprocessingml.document)
﻿
﻿
﻿
YashanDB-可变列式存储.docx
239.1 KB
﻿
 (application/vnd.openxmlformats-officedocument.wordprocessingml.document)
﻿
﻿
﻿
YashanDB Coral.docx
88.9 KB
﻿
 (application/vnd.openxmlformats-officedocument.wordprocessingml.document)
﻿
﻿
﻿
YashanDB Coral.docx
88.9 KB
﻿
 (application/vnd.openxmlformats-officedocument.wordprocessingml.document)
﻿
﻿
﻿
事务内幕文档.docx
136.9 KB
﻿
 (application/vnd.openxmlformats-officedocument.wordprocessingml.document)
﻿
﻿
﻿
YashanDB-DSI - Heap.doc
624.5 KB
﻿
 (application/msword)
﻿
﻿
﻿
YashanDB-DSI - Heap.doc
624.5 KB
﻿
 (application/msword)
﻿
﻿
﻿
YashanDB-DSI - SSM.doc
572 KB
﻿
 (application/msword)
﻿
﻿
﻿
YashanDB-DSI - Segment.doc
159.5 KB
﻿
 (application/msword)
﻿
﻿
﻿
image2022-8-15_15-20-3.png
184.5 KB
﻿
 (image/png)
﻿
﻿
﻿
image2022-8-15_15-20-15.png
285.1 KB
﻿
 (image/png)
﻿
﻿
﻿
索引内幕文档.pptx
403.4 KB
﻿
 (application/vnd.openxmlformats-officedocument.presentationml.presentation)
﻿
﻿
﻿
索引内幕文档.pptx
403.4 KB
﻿
 (application/vnd.openxmlformats-officedocument.presentationml.presentation)
﻿
﻿
﻿
LOB内幕文档.pptx
220.3 KB
﻿
 (application/vnd.openxmlformats-officedocument.presentationml.presentation)
﻿
﻿
﻿
LOB内幕文档.pptx
220.3 KB
﻿
 (application/vnd.openxmlformats-officedocument.presentationml.presentation)
﻿
﻿
﻿
YashanDB-DSI - Xact.pptx
462 KB
﻿
 (application/vnd.openxmlformats-officedocument.presentationml.presentation)
﻿
﻿
﻿
存储引擎-Coast.pptx
295 KB
﻿
 (application/vnd.openxmlformats-officedocument.presentationml.presentation)
﻿
﻿
﻿
存储引擎-Coast.pptx
295 KB
﻿
 (application/vnd.openxmlformats-officedocument.presentationml.presentation)
﻿
﻿
﻿
YashanDB-DSI - Redo.pptx
463.9 KB
﻿
 (application/vnd.openxmlformats-officedocument.presentationml.presentation)
﻿
﻿
﻿
YashanDB-DSI - Replication.pptx
264.5 KB
﻿
 (application/vnd.openxmlformats-officedocument.presentationml.presentation)
﻿
﻿
﻿
YashanDB-DSI - Backup.pptx
311.5 KB
﻿
 (application/vnd.openxmlformats-officedocument.presentationml.presentation)
﻿
﻿
﻿
索引内幕文档.pptx
403.4 KB
﻿
 (application/vnd.openxmlformats-officedocument.presentationml.presentation)
﻿
﻿
﻿
LOB内幕文档.pptx
220.3 KB
﻿
 (application/vnd.openxmlformats-officedocument.presentationml.presentation)
﻿
﻿
﻿
存储引擎-Coral.pptx
118.5 KB
﻿
 (application/vnd.openxmlformats-officedocument.presentationml.presentation)
﻿
﻿
﻿
SWF.pptx
330.6 KB
﻿
 (application/vnd.openxmlformats-officedocument.presentationml.presentation)
﻿
﻿
﻿
TableSpace.pptx
320.7 KB
﻿
 (application/vnd.openxmlformats-officedocument.presentationml.presentation)
﻿
﻿
﻿
DataBuffer.pptx
128.2 KB
﻿
 (application/vnd.openxmlformats-officedocument.presentationml.presentation)
﻿
﻿
﻿
Persistence.pptx
218.4 KB
﻿
 (application/vnd.openxmlformats-officedocument.presentationml.presentation)
﻿
﻿
﻿
存储引擎 - Heap.pptx
217 KB
﻿
 (application/vnd.openxmlformats-officedocument.presentationml.presentation)
﻿
﻿
﻿
存储引擎 - Segment.pptx
131.8 KB
﻿
 (application/vnd.openxmlformats-officedocument.presentationml.presentation)
﻿
﻿
﻿
存储引擎 - SSM.pptx
147.1 KB
﻿
 (application/vnd.openxmlformats-officedocument.presentationml.presentation)
﻿
﻿
﻿
存储引擎 - Segment.pptx
131.8 KB
﻿
 (application/vnd.openxmlformats-officedocument.presentationml.presentation)
﻿
﻿
﻿
Persistence.pptx
218.4 KB
﻿
 (application/vnd.openxmlformats-officedocument.presentationml.presentation)
﻿
﻿
﻿
YashanDB-DSI-DC.pptx
355 KB
﻿
 (application/vnd.openxmlformats-officedocument.presentationml.presentation)
﻿
﻿
﻿
存储引擎 - Heap.pptx
217 KB
﻿
 (application/vnd.openxmlformats-officedocument.presentationml.presentation)
﻿
﻿
﻿
LSC.pptx
292 KB
﻿
 (application/vnd.openxmlformats-officedocument.presentationml.presentation)
﻿
﻿
﻿
image2022-8-18_18-4-57.png
403.4 KB
﻿
 (image/png)
﻿
﻿
﻿
索引内幕文档.pptx
403.4 KB
﻿
 (application/vnd.openxmlformats-officedocument.presentationml.presentation)
﻿
﻿
﻿
4.jpg
3.5 KB
﻿
 (image/jpeg)
﻿
﻿
﻿
repliaction.pptx
240.6 KB
﻿
 (application/vnd.openxmlformats-officedocument.presentationml.presentation)
﻿
﻿
﻿
YashanDB-DSI - Backup.pptx
311.5 KB
﻿
 (application/vnd.openxmlformats-officedocument.presentationml.presentation)
﻿
﻿
﻿
1.jpg
13.3 KB
﻿
 (image/jpeg)
﻿
﻿
﻿
2.jpg
23.9 KB
﻿
 (image/jpeg)
﻿
﻿
﻿
1.jpg
13.3 KB
﻿
 (image/jpeg)
﻿
﻿
﻿
2.jpg
23.9 KB
﻿
 (image/jpeg)
﻿
ADadmin
发布于 2024年11月17日 10:13
阅读 · 78