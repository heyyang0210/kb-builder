Created by 马志宏, last modified by  张旭涛 on 十一月 02, 2023

IR链接：    [https://jira.yasdb.com/browse/YDBRD-14354](https://jira.yasdb.com/browse/YDBRD-14354)  

参考资料：

  [RMAN中基于copy的全备合并增备进行增量备份的方式_rman全备增备_Samdy_Chan的博客-CSDN博客](https://blog.csdn.net/samdy_chan/article/details/78216130)  

  [oracle gap 增量备份,运用incremental backup（增量备份）恢复归档GAP的DG_缘与结阿囧的博客-CSDN博客](https://blog.csdn.net/weixin_35991223/article/details/116512043?spm=1001.2101.3001.6650.2&utm_medium=distribute.pc_relevant.none-task-blog-2%7Edefault%7EBlogCommendFromBaidu%7ERate-2-116512043-blog-103200164.235%5Ev38%5Epc_relevant_anti_t3&depth_1-utm_source=distribute.pc_relevant.none-task-blog-2%7Edefault%7EBlogCommendFromBaidu%7ERate-2-116512043-blog-103200164.235%5Ev38%5Epc_relevant_anti_t3&utm_relevant_index=3)  

  [Dataguard gap修复(增量+手动)_oracle dataguard gap_iverycd的博客-CSDN博客](https://blog.csdn.net/kiral07/article/details/87191787?spm=1001.2101.3001.6650.3&utm_medium=distribute.pc_relevant.none-task-blog-2%7Edefault%7ECTRLIST%7ERate-3-87191787-blog-116512043.235%5Ev38%5Epc_relevant_anti_t3&depth_1-utm_source=distribute.pc_relevant.none-task-blog-2%7Edefault%7ECTRLIST%7ERate-3-87191787-blog-116512043.235%5Ev38%5Epc_relevant_anti_t3&utm_relevant_index=4)  

  


## 1. Overview（概述）

增量合并恢复，可以使用同一数据库连续的增量备份集对同一个db做连续的增量恢复。

  


## 2. Features（功能特性）

  


指定incremental的restore，首次必须为level 0的备份集，后续可以restore 连续的level 1备份集。

## 3. Interfaces（接口）

  


restore database incremental from ‘path’  ；

指定incremental字段， restore之后db状态为nomount

  


restore database  incremental noredo from ‘path’  ；

指定noredo字段， restore之后db状态为nomount，且没有恢复redo和归档文件，此时不可mount database。

  


可以对同一数据库做连续restore

## 4. Specification And Constraints（规格与约束）

  


1. 首次restore， 必须为level 0的备份集。
1. 必须为同一数据库的连续增量备份集（如果restore 非连续备份集可能导致数据丢失），不能跨级restore。
1. 如果要执行连续增量restore。不可在中间环境执行recover，否则后续备份集无法在该db上继续执行restore。（达梦不可执行、）
1. restore 完成之后。db状态为 DB_RESTORE_COMPLETED ，此时可以继续执行restore，如果执行完 recover之后，db状态变为 DB_CREATE_COMPLETED，不可继续执行后续的增量备份链的增量备份。（对外不可见）
1. 若每次的restore 语句都指定noredo，恢复出来的备份集都没有redo文件和归档，无法mount。若要拉起db正常使用，最后一次restore去掉noredo参数恢复即可。
1. 如果连续增量备份集中包含slice文件，连续restore必须严格按照备份生成顺序restore，若未遵守该规则，可能导致slice文件丢失。 如果restore失败使用同一个备份集重复restore，可能会因为已存在slice文件导致restore失败，这种情况下只能通过手动清除对应slice文件后继续执行restore。


## 5. Abnormal scenario（异常场景）

  


1. 基线恢复失败，与普通的增量恢复表现一致，重试即可。
1. 后续的备份集如果restore 失败，需要使用同一备份集重试，否则已经修改的数据块无法回退。restore对db文件的修改不可逆。
1. restore 任一增量备份集完成之后都可重启，拉起至mount状态，然后继续恢复后续的增量备份集。


## 6. Detail Design（详细设计）

  


1. 首次 增量restore  只能恢复independ的level 0备份集。后续对同一db的restore 都必须是连续的备份集。（首次的restore 和 普通的增量恢复实现一致），需要指定为restore database incremental 
1. restore 完成之后，db处于nomount状态，可以继续指定restore  database incremental后续的增量备份集，如果不考虑做后续的增量restore，在最后一次不可指定noredo，然后拉起至mount，然后recover database ， open后即可正常使用。


  


  


![](https://pingcode.yasdb.com/atlas/files/public/67396c75a1ad9a3311dc8aa4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQ0FBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFDQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFFQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDA5NjYsImV4cCI6MTc4MjMxMTc2Nn0.HoLXfgsA12ul-iZSSvOoAgQTltWcD-DY16nfjAwiozY)

  


后续增量备份集的baselsn为指定基线tag备份集的trunclsn。

即备份集的baselsn必须小于等于ctrl中记录的trunclsn，并且备份集中的flushlsn必须大于ctrl中的flushlsn。否则会导致数据回退至旧数据。

  


数据文件： 

数据文件有原有dbfiles中的ctrl文件一 一对比，确定表空间数据文件的增删、resize。增量备份集中记录的baselsn。直接覆盖已存在的数据文件。

  


bucket文件：使用增量备份集中的文件直接覆盖。

  


restore指定noredo，不恢复备份集中的redo 和归档文件。

若要恢复成正常库使用，在最后一次restore 不指定noredo即可，会正常恢复redo和归档文件，恢复完成之后可正常拉起至mount 、recover database、 open。

##   [7. TODO（遗留问题）](https://conf.yasdb.com/pages/viewpage.action?pageId=91780307#8-todo%E9%81%97%E7%95%99%E9%97%AE%E9%A2%98)  

*说明本方案遗留的问题或下一步需要解决的问题。*

## Attachments:

## Comments:

|  [](null)  ,会议纪要,与会人：马志宏、张旭涛、朱国旭、高亚宁、    
  评审时间：2023.8.12  10:00    
  评审地点：西安会议室2    
  评审纪要信息：,1. 语法设计合理
1. 符合当前备份恢复设计
,  
  评审通过与否：是（无需再次评审）,Posted by zhangxutao at 十二月 11, 2023 20:30|
|---|
