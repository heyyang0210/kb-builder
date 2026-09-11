Created by 黄思源, last modified on 五月 11, 2024

*详细设计-YDBRD-*  *26446*  * : OM支持分布式在线滚动升级方案设计*

*IR链接：*    [https://pingcode.yasdb.com/ship/ideas/660b7481009f91eb87f2bfd3](https://pingcode.yasdb.com/ship/ideas/660b7481009f91eb87f2bfd3)    *?*    
  *#YASHAN-1223 Om支持分布式在线滚动升级*

*SR链接：*    [https://pingcode.yasdb.com/pjm/items/661e7b28fd997db58adaea43](https://pingcode.yasdb.com/pjm/items/661e7b28fd997db58adaea43)    *?*    
  *#YDBRD-26446 【Om】支持分布式在线滚动升级*

  


##   [1. 总述](#1-总述)  

OM支持分布式小版本在线滚动升级。

###   [1.1 需求来源](#11-需求来源)  

需求来源：产品化需求需求描述：Om支持小版本（第四位）的在线滚动升级（主备机）。1、支持二进制兼容2、支持分布式

###   [1.2 调研文档](#12-调研文档)  

  [单机滚动升级设计文档](https://conf.yasdb.com/pages/viewpage.action?pageId=127652425)  

  [分布式滚动升级](https://conf.yasdb.com/pages/viewpage.action?pageId=135616174)  

###   [1.3 需求分析](#13-需求分析)  

|属性|场景名称|方案设计|关键技术点|特性是否涉及|
|---|---|---|---|---|
|功能|仅支持小版本（第四位）差异|升级前校验是否小版本升级，如果不是，则不允许滚动升级|否|是|
|功能|MN或DN组内只有一个节点|不允许滚动升级，退出|是|是|
|功能|开启仲裁的时候，执行滚动升级|不允许，退出|否|是|
|兼容性|仅支持从以前版本升级到当前这个版本|放开不允许分布式滚动升级的约束|否|是|
|可靠性|滚动升级失败后支持回滚|支持回滚|是|是|


##   [2. 接口](#2-接口)  

接口没有变动，以下仅列举涉及到的命令。

1.   `package upgrade`  
1. 升级yasom和yasagent
1.   `cluster upgrade`  
1.   `cluster rollback`  


|参数|含义|
|---|---|
|--keep-primary|保留主节点|
|--rolling|滚动升级|


|参数|含义|
|---|---|
|--rolling|滚动升级，不能和force一起使用|


##   [3. 规格与约束](#3-规格与约束)  

1. 不允许扩缩容。
1. 升级前各节点运行正常。
1. MN组和DN组至少有两个节点。


##   [4. 特性](#4-特性)  

###   [4.1 升级](#41-升级)  

![](https://pingcode.yasdb.com/atlas/files/public/67396d5ba1ad9a3311dc90b6/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQlNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDc2NTUsImV4cCI6MTc4MjMxODQ1NX0.bHiohgE3gluHrsq4o6nICGkWjTjo1L1P_Pri-ef19Ik)



1. 校验是否符合滚动升级的要求。
1.     - 仲裁未开启
    - 节点需要正常
    - 只有最后一位版本不同
    - MN组和DN组至少有两个节点

1. 新旧数据库安装目录的dbcr目录的md5是否相同
1. 升级各MN组（参考DN组升级）
1. 升级各DN组（DN组做成并行升级，OM任务最大的并发量是10）
    1. 关闭各节点自动选举开关（先备后主）。
    1. 两节点在最大可用模式下执行滚动升级，三节点及以上不修改保护模式（先主后备）。
    1. 关闭备库。
    1. 用新版本拉起备机，等待备节点同步完（select * from v$replication_status; apply_lag < 1s, connection, status）
    1. 重复步骤三，四，依次将同一组内所有备机升级完毕。
    1. 选择一个备节点进行switchover升主，等待启动完成
    1. 将旧主（备节点）进行步骤三，四的操作。
    1. 恢复原自动选举开关（先主后备）。恢复保护模式（先主后备）。
    1. 根据--keep-primary参数决定是否切回原主。
1. 依次升级CN节点。
    1. 执行shutdown immediate方式，快速关闭，尽量减少关闭时间。
    1. 升级前备份（冷备份，用于回退，CN节点是否需要备份）
    1. 用新版本拉起CN节点。（CN不需要等待同步）


###   [4.2 回滚](#42-回滚)  

约束：

1. 回滚的时候如果不存在主节点（按照滚动升级的流程，应该要存在主节点），则无法完成回滚。
1. 主节点是新版本，超过一个节点是不存活的（说明新版本节点和旧版本节点都有挂了的），则无法完成回滚。
1. 一个新版本主节点和多个旧版本备节点（这种场景是不应该出现的，主节点是新版本的时候，说明应该只剩最后一个旧版本节点没有升级），则无法完成回滚。


![](https://pingcode.yasdb.com/atlas/files/public/67396d5ba1ad9a3311dc90b7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQVFBQUFBQUFBQUFBQUFBQUFBQUFBQUJBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQlNBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVBQUFBQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBQUFBQUFCQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIzMDc2NTUsImV4cCI6MTc4MjMxODQ1NX0.bHiohgE3gluHrsq4o6nICGkWjTjo1L1P_Pri-ef19Ik)



1. 回滚MN
1. 回滚DN
    1. 主节点是旧版本
    1.         - 找出挂了的备节点和新版本的备节点。
        - 依次用旧版本拉起节点。
        - 恢复节点升级前的HA和保护模式。

    1. 主节点是新版本
    1.         - 选定一个旧版本的节点切换为主节点（挂了的节点 or 旧版本的节点）。
        - 依次用旧版本拉起节点。
        - 恢复节点升级前的HA和保护模式。

1. 回滚CN（依次回滚）
1.     - 停止新版本的CN
    - 用旧版本拉起CN节点



##   [5. Testcases（自测用例）](#5-testcases自测用例)  

##   [6.资料设计章节](#6资料设计章节)  

##   [7.未来规划](#7未来规划)  

## Attachments:

## Comments:

|  [](null)  ,会议纪要：    
  时间：2024.5.11 10:00-11:00    
  与会人：瞿蓝孟、李世铭、刘美秀、许中立、黄思源,1. 升级过程中不支持通过OM开启仲裁/开关自选主/重分布/扩缩容/启停/swichover/failover等操作。    
  2. 升级过程中不备份节点数据。    
  3. CN串行升级/回退。    
  4. 支持isLocal=true的场景。,Posted by huangsiyuan at 五月 11, 2024 14:14|
|---|
