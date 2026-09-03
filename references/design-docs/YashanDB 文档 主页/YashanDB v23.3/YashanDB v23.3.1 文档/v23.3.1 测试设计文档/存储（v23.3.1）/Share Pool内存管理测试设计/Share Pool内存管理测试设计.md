Created by 刘丹, last modified on 七月 25, 2024

# **1. 概述**

Share pool是SGA的重要组成部分，用于数据库会话间共享资源的缓存，由一系列子pool构成。share pool包括以下子pool。但是目前share pool的内存虽然是统一配置，但是子pool之间的内存无法动态均衡，导致需要用户根据不同业务场景进行调整，配置难度较大，易用性很差。

Share pool内存统一管理的目的是为了解决内存配置困难的问题，数据库内部会根据实际诉求动态调整子pool的内存，对用户完全透明。

# **2. 需求分析**

SR链接：    [https://pingcode.yasdb.com/pjm/items/66592bdd288e197820989cb7](https://pingcode.yasdb.com/pjm/items/66592bdd288e197820989cb7)    ?    
  #YDBRD-28580 支持Share Pool内存自动管理

开发设计：    [Share Pool内存管理 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=156111143)  

## 2.1 功能点分析

     1.原本pool不足的场景，在目前版本因动态均衡功能不报pool不足

     2.调整配置参数，老版本构造pool 不足的场景,新版本在去执行，性能不劣化

     3.淘汰有优先级，share pool减去其它的pool，还有一个free pool，当pool不足的时候，会先抢占freee pool，,然后去一次去抢占sql pool,dc pool,lock pool。

  


  


## 2.2 规格约束

- 目前仅支持dc pool，sql pool, lock pool的动态均衡，其他组件为固定内存
- v$share_pool，gv$share_pool 新增列统计各个子pool动态均衡的内存。


# **3. 测试**  **设计方法**   

1. 部署方式：单机、集群、分布式
1. 内存管理功能生效：构造sql pool,dc pool,lock pool不足的场景，老版本报错，新版本走动态均衡不报错，查询视图
1. 性能：CI对比之前的性能是否有劣化
1. 系统级DFX分类


|系统级DFX分类|是否涉及|
|:---|:---|
|CT|涉及|
|KT|不涉及，|
|长稳|不涉及|
|一致性|不涉及|
|三方测试工具    
  (sqltest，sqlancer)|不涉及，  转测功能不涉及该模块修改|
|安全|不涉及，  转测功能不涉及该模块修改|
|DFR|不涉及，  转测功能不涉及该模块修改|
|HA|不涉及|
|压力|不涉及，  转测功能不涉及该模块修改|
|性能|涉及，需要考虑与原本对比性能是否劣化|
|可维护性|不涉及，  转测功能不涉及该模块修改|
|资料|涉及|


# 4.   **详细测试设计**   

|验证点|验证场景|预期|说明|
|:---|:---|:---|:---|
|视图新增字段验证|直接desc，select *查询  v$share_pool，gv$share_pool|有新增字段，字段描述准确，字段类型正确|pool不足的场景在老版本构造，新版本再去确认动态申请内存是否生效|
|  
|构造pool不足的场景，去查询视图|视图有变化|  
|
|场景测试|调整隐藏参数  DICTIONARY_CACHE_SIZE的大小，构造dc pool不足|可动态申请内存，无内存泄漏|  
|
|  
|调整隐藏参数  SQL_POOL_SIZE  的大小，构造sql pool不足|  
|  
|
|  
|调整隐藏参数  LOCK_POOL_SIZE  的大小，构造lock pool不足|  
|  
|
|覆盖3种|调整参数share pool，构造大事务和多用户，使得dc pool和lock pool占用大量空间，sql pool申请不出来空间,通过失效对象的方式，释放出来一部分dc pool的空间，sql pool申请空间正常|sql pool申请不出来空间时报错，在dc pool失效一部分后成功|内存占用较大，动态均衡不出来空间，释放掉一部分，在分配成功|
|优先级测试|构造场景占满sql pool，dc pool和lock pool，在申请sql pool从free pool中申请，|free_pool减少|  
|
|  
|构造场景占满sql pool，dc pool和lock pool，free pool，再去申请sql pool，会首先从dc pool淘汰|dc pool占用内存减少|  
|
|性能|老版本改变配置参数，构造pool不足的场景，新版本使用同样的参数去执行|性能无劣化|  
|


# 5.   **测试用例**

1、测试设计评审时提供冒烟文本用例；

2、启动测试之前提供文本用例，并完成大部分自动化用例；

[share_pool文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODI4OTcwYzJhZjRmNTIxOTBkIiwicmVmX2lkIjoiNjczOTZlODI1OTNmOTljOWZmMjM4NTk0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM3NjQyLCJleHAiOjE3ODI1MjQwNDJ9.BmQirm5P7OC2FRj_goX0FGeE_7O2OWm2Xde2OwpQlsg)

  [share pool性能测试 - 刘丹 - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=159438871)  

# 6.   **测试框架设计**

自动化用例添加到regress框架

# 7.   **测试环境说明**

|服务器|  
|
|:---|:---|
|操作系统|Linux|
|部署|  
|


## Attachments:

[share_pool文本用例.xlsx](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZlODI4OTcwYzJhZjRmNTIxOTBkIiwicmVmX2lkIjoiNjczOTZlODI1OTNmOTljOWZmMjM4NTk0IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDM3NjQyLCJleHAiOjE3ODI1MjQwNDJ9.BmQirm5P7OC2FRj_goX0FGeE_7O2OWm2Xde2OwpQlsg)

 (application/vnd.openxmlformats-officedocument.spreadsheetml.sheet)    


## Comments:

|  [](null)  ,主题：share pool内存管理测试设计评审    
  与会人：刘丹、郑荃、陈晓晴    
  会议时间：2024/7/15 16:30-17:00    
  会议地点：线上会议    
  会议纪要:,1、增加测试点：注意pool淘汰申请顺序,2、需要构造free pool的场景,Posted by liudan at 七月 16, 2024 14:26|
|---|
