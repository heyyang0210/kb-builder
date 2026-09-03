Created by 易文亮, last modified on 三月 28, 2024

##   [1. 需求概述](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#1-%E9%9C%80%E6%B1%82%E6%A6%82%E8%BF%B0)  

*需求与场景概述*

*需求来源要说明特性支持的部署形态为 主备(单机)、分布式、集群，部分特性视情况下需要细分 单机行执行 和 单机列执行*

*IR：*  *  *    [YDBRD-6551](https://jira.yasdb.com/browse/YDBRD-6551?src=confmacro)    *-*  *分布式列表支持大LOB*  *完成*

*开发概要设计：*    [LOB存储概要设计 - YashanDB存储引擎 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=141569776)  

**部署形态**  ：

单机+分布式

**需求来源背景：**

外部常规使用。LOB(Large Object)即为大对象，当需要存储可能占用空间非常大的数据时，可以使用LOB数据类型。LOB数据类型在行内存储一个指针，指向真正存储LOB数据的页面。

**需求描述：**

YashanDB Lob数据类型支持BLOB，CLOB和NCLOB，对于存储而言，不管是哪种LOB，存储方式都一样。几种Lob的区别在于上层对于数据的展示方式以及读取方式。LOB存储有以下特征：

- LOB类型的存储方式分为行内（InRow）存储和行外（OutRow）存储
- LOB数据行内部分需要存储一些LOB的元信息（lobid，是否inrow，字符长度等），这部分叫做LobCoupon
- 行表对于小于4000字节的LOB数据存储在行内，叫做行内LOB，数据直接跟在LobCoupon后面
- 对于需要行外存储的LOB数据，LOB数据存储在单独的LOB segment，LobCoupon后面存储LOB数据页面id
- LOB数据没有undo，对于更新，新写一个LOB数据，修改行内LobCoupon，相当于LOB是自undo
- LOB对象拥有一个LOB INDEX对象，通过LOB INDEX加速LOB数据访问以及实现LOB页面的空闲空间管理


  [2. 功能点](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#2-%E5%8A%9F%E8%83%BD%E7%82%B9)  

1）LOB创建，涉及    [Lob Segment](https://conf.yasdb.com/pages/viewpage.action?pageId=141569776#41-lob-segment)    和    [Lob Index](https://conf.yasdb.com/pages/viewpage.action?pageId=141569776#42-lob-index)    ，确认LOB相关视图属性

### 2）LOB的insert/delete/update/select，相关函数运算

### 3）LOB的高级包、jdbc等接口使用

  


##   [3. 规格约束](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#3-%E8%A7%84%E6%A0%BC%E7%BA%A6%E6%9D%9F)  

*列表不支持outlob运算*

*不支持insert into select outlob/create table as *  *select outlob*

##   [4. 主要应用场景](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#4-%E4%B8%BB%E8%A6%81%E5%BA%94%E7%94%A8%E5%9C%BA%E6%99%AF)  

  


**需求主要应用场景：**

1、验证lob的insert/update/delete功能，数据从行内到行外迁移

2、验证jdbc下4G的数据读写

3、结合lob高级包验证lob的接口、jdbc等功能

**与其它特性关联场景：**

结合列修改、跨分区更新、表空间迁移等

##   [5. 概要测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#5-%E6%A6%82%E8%A6%81%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

###   [5.1 功能测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#51-%E5%8A%9F%E8%83%BD%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

*1.本设计主要采样场景测试法和异常测试分析法，通过构造各种并发场景、任务打断场景、合并场景等，分别验证各场景符合优化要求。*

###   [5.2 DFX测试设计](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#52-dfx%E6%B5%8B%E8%AF%95%E8%AE%BE%E8%AE%A1)  

*性能、高可用、CT、KT、可维护性、可测试性、一致性、长稳、安全性、升级、DFR、压力*    
  *1.协议、驱动、访问控制、通讯、加密等特性需求，要考虑安全；*    
  *2.DML+DQL特性需求，需要考虑性能；*    
  *3.主备、容灾、存储等的特性需求，需要考虑可靠性；*    
  *4.外部常用语法、基础功能要考虑增加稳定性用例；*    
  *5.所有特性均需要考虑可维、可测，可要求研发提供必要的视图。*

##   [6. 测试策略](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#6-%E6%B5%8B%E8%AF%95%E7%AD%96%E7%95%A5)  

*测试覆盖策略、自动化看护策略*

*主要sql功能用例使用Guider调用yasft看护，主要场景功能用例使用ha_regress框架*

  


##   [7. 后续关注(可选)](https://conf.yasdb.com/pages/viewpage.action?pageId=133568047#7-%E5%90%8E%E7%BB%AD%E5%85%B3%E6%B3%A8%E5%8F%AF%E9%80%89)  

*依赖特性识别*

*后续测试详细设计中需要关注的内容*

结合具体的资源优化方案、合并改造方案进行详细设计。

## Attachments:

[image2023-7-18_9-23-0.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NDJhMWFkOWEzMzExZGM3NTUzIiwicmVmX2lkIjoiNjczOTY5NDI3MjgyMDZlZmI5MmVmMTQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2MzM5LCJleHAiOjE3ODIyMTI3Mzl9.Hx9eUgDRJRZQXKrQh40SYMKKaQ-AMo63H1b2J3lCHDA)

 (image/png)    


[image2023-7-18_9-23-13.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NDJhMWFkOWEzMzExZGM3NTU0IiwicmVmX2lkIjoiNjczOTY5NDI3MjgyMDZlZmI5MmVmMTQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2MzM5LCJleHAiOjE3ODIyMTI3Mzl9.qi6sm0S6frSes9JQqV8O56ue42DxA4nxY7_V3tm0YLA)

 (image/png)    


[image2023-7-18_9-23-32.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NDI4OTcwYzJhZjRmNTFmNmRmIiwicmVmX2lkIjoiNjczOTY5NDI3MjgyMDZlZmI5MmVmMTQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2MzM5LCJleHAiOjE3ODIyMTI3Mzl9.ba2ZuueoofnMNDp9TOmM9TIiAzm2Btx_0nK1XAxWKDc)

 (image/png)    


[image2023-7-18_9-24-55.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTY5NDI4OTcwYzJhZjRmNTFmNmUwIiwicmVmX2lkIjoiNjczOTY5NDI3MjgyMDZlZmI5MmVmMTQyIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMTI2MzM5LCJleHAiOjE3ODIyMTI3Mzl9.66wrzmfR8VXkNx9Wwn-hrcWFcOjUCo9ETfq1RFiQjbE)

 (image/png)    
