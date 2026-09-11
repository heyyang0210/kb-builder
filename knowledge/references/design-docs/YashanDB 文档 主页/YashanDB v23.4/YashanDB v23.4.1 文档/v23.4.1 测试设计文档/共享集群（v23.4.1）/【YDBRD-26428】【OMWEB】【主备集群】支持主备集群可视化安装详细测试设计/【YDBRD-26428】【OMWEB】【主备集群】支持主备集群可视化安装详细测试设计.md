Created by 张志华 on 十月 31, 2024

# 1. 概述

OM支持可视化部署主备集群

# 2. 需求分析

SR：    [https://pingcode.yasdb.com/pjm/items/661e3dc8fd997db58adabd53](https://pingcode.yasdb.com/pjm/items/661e3dc8fd997db58adabd53)    ?    
  #YDBRD-26428 【OMWEB】【主备集群】支持主备集群可视化安装

设计文档：    [【omweb】功能补全：共享集群主备，单机级联备，单机部分自选主](https://conf.yasdb.com/pages/viewpage.action?pageId=167155665)  

## 2.1 功能点分析

**接口变更**

- **新增**  ：


1. “集群组数量”【ce_group】：最大值为33，最小值为1，默认值为1，必填。
1. “备集群节点数量”【standby_node】：集群组数量>=2的时候，弹出来让用户填写。  最大值不大于“主集群节点数量”，最小值为1，默认值和“主集群节点数量”一致，必填。


- **重命名**  ：“集群节点数量”→“主集群节点数量”，最大值为64，最小值为1，默认值为2，必填。（确认约束条件）


**页面变更**

【3.数据库节点配置信息->节点规模->编辑】

![](https://conf.yasdb.com/download/attachments/167155665/%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4%E7%94%9F%E6%88%90%E9%85%8D%E7%BD%AE.png?api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFCQVFBQUFBQUFBRUFBQUFBQWhBQUFBQUFBQUFBQUFBQUFDRUFBQUFBQUNBQUFJQUFBQUFJQUFBQUFBQVFnQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFRQVFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUlBQUFRQUFBSUFBQUFCQUFBQkFBQUFBQUFBQUFBQUFBUVNBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTgwMTEsImV4cCI6MTc4MjQ2ODgxMX0.2PsTlOSR1X_Urhh0yR46A_LOC0VzT7TRahzC98d9aV4)

![](https://conf.yasdb.com/plugins/servlet/confluence/placeholder/error?i18nKey=editor.placeholder.broken.image&locale=zh_CN&version=2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFCQVFBQUFBQUFBRUFBQUFBQWhBQUFBQUFBQUFBQUFBQUFDRUFBQUFBQUNBQUFJQUFBQUFJQUFBQUFBQVFnQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFRQVFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUlBQUFRQUFBSUFBQUFCQUFBQkFBQUFBQUFBQUFBQUFBUVNBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTgwMTEsImV4cCI6MTc4MjQ2ODgxMX0.2PsTlOSR1X_Urhh0yR46A_LOC0VzT7TRahzC98d9aV4)

【3.数据库节点配置信息->节点规模】

![](https://conf.yasdb.com/download/attachments/167155665/%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4%E8%8A%82%E7%82%B9%E8%A7%84%E6%A8%A1.png?api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFCQVFBQUFBQUFBRUFBQUFBQWhBQUFBQUFBQUFBQUFBQUFDRUFBQUFBQUNBQUFJQUFBQUFJQUFBQUFBQVFnQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFRQVFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUlBQUFRQUFBSUFBQUFCQUFBQkFBQUFBQUFBQUFBQUFBUVNBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTgwMTEsImV4cCI6MTc4MjQ2ODgxMX0.2PsTlOSR1X_Urhh0yR46A_LOC0VzT7TRahzC98d9aV4)

![](https://conf.yasdb.com/plugins/servlet/confluence/placeholder/error?i18nKey=editor.placeholder.broken.image&locale=zh_CN&version=2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFCQVFBQUFBQUFBRUFBQUFBQWhBQUFBQUFBQUFBQUFBQUFDRUFBQUFBQUNBQUFJQUFBQUFJQUFBQUFBQVFnQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFRQVFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUlBQUFRQUFBSUFBQUFCQUFBQkFBQUFBQUFBQUFBQUFBUVNBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTgwMTEsImV4cCI6MTc4MjQ2ODgxMX0.2PsTlOSR1X_Urhh0yR46A_LOC0VzT7TRahzC98d9aV4)

【3.数据库节点配置信息->集群特有参数配置】

![](https://conf.yasdb.com/download/attachments/167155665/%E9%9B%86%E7%BE%A4%E7%89%B9%E6%9C%89%E5%8F%82%E6%95%B0%E9%85%8D%E7%BD%AE.png?api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFCQVFBQUFBQUFBRUFBQUFBQWhBQUFBQUFBQUFBQUFBQUFDRUFBQUFBQUNBQUFJQUFBQUFJQUFBQUFBQVFnQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFRQVFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUlBQUFRQUFBSUFBQUFCQUFBQkFBQUFBQUFBQUFBQUFBUVNBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTgwMTEsImV4cCI6MTc4MjQ2ODgxMX0.2PsTlOSR1X_Urhh0yR46A_LOC0VzT7TRahzC98d9aV4)

![](https://conf.yasdb.com/plugins/servlet/confluence/placeholder/error?i18nKey=editor.placeholder.broken.image&locale=zh_CN&version=2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFCQVFBQUFBQUFBRUFBQUFBQWhBQUFBQUFBQUFBQUFBQUFDRUFBQUFBQUNBQUFJQUFBQUFJQUFBQUFBQVFnQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFRQVFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUlBQUFRQUFBSUFBQUFCQUFBQkFBQUFBQUFBQUFBQUFBUVNBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTgwMTEsImV4cCI6MTc4MjQ2ODgxMX0.2PsTlOSR1X_Urhh0yR46A_LOC0VzT7TRahzC98d9aV4)

【4.数据库建库参数->节点组参数配置/建库参数】

> 来源是第五页，只有共享集群有这两个tab。单机和分布式没有。

有变更的时候，需要填充到对应的group的ycsconfig和yfsconfig字段中

![](https://conf.yasdb.com/download/attachments/167155665/%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4%E8%8A%82%E7%82%B9%E7%BB%84%E5%8F%82%E6%95%B0%E9%85%8D%E7%BD%AE.png?api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFCQVFBQUFBQUFBRUFBQUFBQWhBQUFBQUFBQUFBQUFBQUFDRUFBQUFBQUNBQUFJQUFBQUFJQUFBQUFBQVFnQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFRQVFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUlBQUFRQUFBSUFBQUFCQUFBQkFBQUFBQUFBQUFBQUFBUVNBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTgwMTEsImV4cCI6MTc4MjQ2ODgxMX0.2PsTlOSR1X_Urhh0yR46A_LOC0VzT7TRahzC98d9aV4)

![](https://conf.yasdb.com/plugins/servlet/confluence/placeholder/error?i18nKey=editor.placeholder.broken.image&locale=zh_CN&version=2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFCQVFBQUFBQUFBRUFBQUFBQWhBQUFBQUFBQUFBQUFBQUFDRUFBQUFBQUNBQUFJQUFBQUFJQUFBQUFBQVFnQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFRQVFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUlBQUFRQUFBSUFBQUFCQUFBQkFBQUFBQUFBQUFBQUFBUVNBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTgwMTEsImV4cCI6MTc4MjQ2ODgxMX0.2PsTlOSR1X_Urhh0yR46A_LOC0VzT7TRahzC98d9aV4)

【5.数据库节点参数->节点参数配置】

删掉《集群类型数据库YFS参数配置》和《集群类型数据库YCS参数配置》

![](https://conf.yasdb.com/download/attachments/167155665/%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4%E8%8A%82%E7%82%B9%E5%8F%82%E6%95%B0%E9%85%8D%E7%BD%AE.png?api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFCQVFBQUFBQUFBRUFBQUFBQWhBQUFBQUFBQUFBQUFBQUFDRUFBQUFBQUNBQUFJQUFBQUFJQUFBQUFBQVFnQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFRQVFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUlBQUFRQUFBSUFBQUFCQUFBQkFBQUFBQUFBQUFBQUFBUVNBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTgwMTEsImV4cCI6MTc4MjQ2ODgxMX0.2PsTlOSR1X_Urhh0yR46A_LOC0VzT7TRahzC98d9aV4)

![](https://conf.yasdb.com/plugins/servlet/confluence/placeholder/error?i18nKey=editor.placeholder.broken.image&locale=zh_CN&version=2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFCQVFBQUFBQUFBRUFBQUFBQWhBQUFBQUFBQUFBQUFBQUFDRUFBQUFBQUNBQUFJQUFBQUFJQUFBQUFBQVFnQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFRQVFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUlBQUFRQUFBSUFBQUFCQUFBQkFBQUFBQUFBQUFBQUFBUVNBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTgwMTEsImV4cCI6MTc4MjQ2ODgxMX0.2PsTlOSR1X_Urhh0yR46A_LOC0VzT7TRahzC98d9aV4)

【6.数据库全局信息->概览】

![](https://conf.yasdb.com/download/attachments/167155665/%E5%85%B1%E4%BA%AB%E9%9B%86%E7%BE%A4%E6%95%B0%E6%8D%AE%E5%BA%93%E5%85%A8%E5%B1%80%E4%BF%A1%E6%81%AF.png?api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFCQVFBQUFBQUFBRUFBQUFBQWhBQUFBQUFBQUFBQUFBQUFDRUFBQUFBQUNBQUFJQUFBQUFJQUFBQUFBQVFnQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFRQVFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUlBQUFRQUFBSUFBQUFCQUFBQkFBQUFBQUFBQUFBQUFBUVNBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTgwMTEsImV4cCI6MTc4MjQ2ODgxMX0.2PsTlOSR1X_Urhh0yR46A_LOC0VzT7TRahzC98d9aV4)

![](https://conf.yasdb.com/plugins/servlet/confluence/placeholder/error?i18nKey=editor.placeholder.broken.image&locale=zh_CN&version=2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFCQVFBQUFBQUFBRUFBQUFBQWhBQUFBQUFBQUFBQUFBQUFDRUFBQUFBQUNBQUFJQUFBQUFJQUFBQUFBQVFnQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFRQVFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUlBQUFRQUFBSUFBQUFCQUFBQkFBQUFBQUFBQUFBQUFBUVNBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTgwMTEsImV4cCI6MTc4MjQ2ODgxMX0.2PsTlOSR1X_Urhh0yR46A_LOC0VzT7TRahzC98d9aV4)

## 2.2 应用场景

可视化安装部署单集群及主备集群，着重测试主备集群安装。

## 2.3 约束

- 无级联备节点；
- 主备集群最大规模：33*64，集群组最大值为33，集群内实例数最大值为64；
- 备集群节点数量要小于等于主集群节点数量。


# 3. 详细测试设计

## 3.1 测试设计方法

参数测试采用边界值、等价类；

功能测试采用场景组合、错误推测法。

## 3.2 详细测试设计

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|否|
|KT|是|
|长稳|否|
|一致性|否|
|三方测试工具    
  (sqltest，sqlancer)|否|
|安全|否|
|DFR|否|
|HA|是|
|压力|否|
|性能|否|
|可维护性|是|


**本次测试通过3方面进行：**

**1、页面参数设置合理、描述清晰；**

**2、参数测试；**

**3、场景组合测试。**

**因场景组合较多，主要通过web页面参数配置项进行罗列。**

**1、页面检查**

|测试点|步骤|预期|
|:---|:---|:---|
|页面描述|1. 检查页面是否符合设计图
1. 页面描述是否准确、无歧义
|1. 符合设计图
1. 页面描述准确、无歧义
|
|页面参数|1. 页面参数是否符合设计图
1. 页面参数是否适配集群，且是否可设置
|1. 符合设计图
1. 页面参数适配集群，且可设置
|
|页面按钮及标志|1. 页面按钮是否可执行
1. 页面标志如必选项、主节点等合理
1. 保存按钮
|1. 可执行
1. 页面标志设置合理
1. 保存所有设置
|
|页面返回|点击上一步/编辑|之前编辑过的仍在，不会被清理|
|  
|  
|  
|


**2、参数测试**

|测试项|取值|预期|
|---|:---|:---|
|集群组数量|1、33、3|成功|
|  
|- 空值、-1
- 0、34
- 0.2、0.8、1.3、1.7
- 29.2、29.5、33.2、33.8
|- 空值、负数不合法
- [0,1.5)都自动更改为1
- 29.5以上都自动更改为33
- 其余四舍五入
|
|主集群节点数|1、64、2|只能取值1|
|  
|- 空值、-1
- 0、65
- 0.4，0.8，1.3，1.8
- 63.3、63.5、64.2、64.9
|- 空值、负数不合法
- [0,1.5)都自动更改为1
- 63.5以上都自动更改为64
- 其余四舍五入
|
|备集群节点数|- 集群组数量为1时
- 集群组数量=2，主集群节点数=64，备集群节点数取值：1、64、63.2、63.5、64.3、64.9
|- 集群组数量为1时，该值不能填写，填写报错
- 备集群节点数小于等于主集群节点数且超过64自动更改为64
|
|  
|- 集群组数量=2，主集群节点数=64，备集群节点数取值：空值、-1、0、65
- 集群组数量=2，主集群节点数=3，备集群节点数取值：4、3.5、4.3
|集群组数大于等于2时，备集群节点数,- 空值、负数不合法
- 大于主集群节点数报错，小数四舍五入
|
|端口|- 1000、60000、1688
|成功|
|  
|- 空值、-1、999、60001
- 999.4，999.8，1000.3，1000.8
- 60000.2、60000.8、60001.2、60001.9
|- 不合法
- 1000以下、60000以上生成配置文件报错
|
|路径|- 绝对路径
- 包含特殊字符
|成功|
|  
|- 相对路径
- 为空
- lun路径长度大于31字符
- 路径不存在
- 路径无权限
|- 安装失败
|
|名称|- 字母开头，大小写、数字、#$_"等特殊字符组合，1-31个字符
|成功|
|  
|- 空值
- 数字、特殊字符开头
- 包括除#$_"的特殊字符、汉字、其他语种
- 与其他同名
|- 安装失败
|


**3、场景组合**

|测试页面|测试项|测试内容|  
|
|:---|:---|:---|:---|
|1.数据库名称、版本、主机选择-快速部署|同3.数据库节点配置信息——节点规模配置|  
|  
|
|6.数据库全局信息|快速部署后点击保存并展示数据库详情|查看概览|与设置一致|
|  
|查看生成的数据库参数配置文件|  
|与设置一致|
|3.数据库节点配置信息——节点规模配置,  
|正常部署|2实例1主2备集群|可以正常部署|
|![](https://pingcode.yasdb.com/atlas/files/public/67396ef8a1ad9a3311dc9b3d/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFCQVFBQUFBQUFBRUFBQUFBQWhBQUFBQUFBQUFBQUFBQUFDRUFBQUFBQUNBQUFJQUFBQUFJQUFBQUFBQVFnQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFRQVFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUlBQUFRQUFBSUFBQUFCQUFBQkFBQUFBQUFBQUFBQUFBUVNBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTgwMTEsImV4cCI6MTc4MjQ2ODgxMX0.2PsTlOSR1X_Urhh0yR46A_LOC0VzT7TRahzC98d9aV4),  
|测试最大规模部署|64实例1主32备集群|可以正常部署|
||单集群部署|2实例集群|可以正常部署|
||磁盘发现路径与数据盘和系统盘不一致|  
|报错，日志报错清晰|
||机器上已安装集群|集群进程存在|  
|
||集群目录不为空|data目录不为空|  
|
||  
|home目录不为空|  
|
||  
|.yasboot目录存在|  
|
||端口占用|web listen端口|  
|
||  
|数据库相关端口占用|  
|
||  
|主备集群间通信端口占用|  
|
||保存按钮|执行保存|保存正常|
|3.数据库节点配置信息——yasom配置|om主机ip|ip选择，无法自动输入|  
|
|  
|listen_addr|1000-60000，参考参数测试|  
|
|  
|保存按钮|执行保存|保存正常|
|3.数据库节点配置信息——yasagent配置|节点都在同一个机器|拖拉后，查看与节点配置一致|  
|
|  
|节点在不同机器|拖拉后，查看与节点配置一致|  
|
|  
|保存按钮|执行保存|保存正常|
|3.数据库节点配置信息——节点配置-ceg1配置|系统磁盘-冗余度external|配置1个故障组|正常部署|
|![](https://pingcode.yasdb.com/atlas/files/public/67396ef88970c2af4f521cca/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFCQVFBQUFBQUFBRUFBQUFBQWhBQUFBQUFBQUFBQUFBQUFDRUFBQUFBQUNBQUFJQUFBQUFJQUFBQUFBQVFnQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFRQVFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUlBQUFRQUFBSUFBQUFCQUFBQkFBQUFBQUFBQUFBQUFBUVNBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTgwMTEsImV4cCI6MTc4MjQ2ODgxMX0.2PsTlOSR1X_Urhh0yR46A_LOC0VzT7TRahzC98d9aV4)|  
|配置2个故障组|报错|
||系统磁盘-冗余度normal|配置3个故障组|正常部署|
||  
|配置2、4个故障组|报错|
||系统磁盘-冗余度high|配置5个故障组|正常部署|
||  
|配置4、6个故障组|报错|
||系统磁盘组-名称|同名称测试一致|  
|
||系统磁盘组-磁盘大小|比设备实际大小小、跟设备大小一致|正常部署|
||  
|比设备实际大小大|报错|
||系统磁盘组-强制安装YFS按钮|选择强制安装|正常部署|
||  
|关闭强制安装|正常部署？|
||系统磁盘组-故障组名称|同名称测试一致|  
|
||系统磁盘组-磁盘设备|磁盘发现路径下磁盘|正常部署|
||  
|为空|报错|
||  
|磁盘添加超过1个|报错|
||  
|设备路径不在磁盘发现下|报错|
||  
|磁盘名超过31字符|报错|
||  
|磁盘路径无权限、不存在|报错|
||数据磁盘组-冗余度external|配置1个故障组|正常部署|
||  
|配置1个故障组，点击故障组删除按钮|故障组不能删除|
||数据磁盘组-冗余度normal|配置2个故障组|正常部署|
||  
|配置1个故障组|报错|
||数据磁盘组-冗余度high|配置3个故障组|正常部署|
||  
|配置1、2个故障组|报错|
||数据磁盘组-名称|同参数测试一致|  
|
||数据磁盘组-磁盘大小|数字 + 空/K/M/G/T|正常部署|
||  
|大小与磁盘大小不一致|报错|
||数据磁盘组-强制安装YFS按钮|选择强制安装|正常部署|
||  
|关闭强制安装|正常部署？|
||数据磁盘组-故障组名称|同参数测试一致|  
|
||数据磁盘组-磁盘设备|磁盘发现路径下磁盘|正常部署|
||  
|为空|报错|
||  
|磁盘添加超过1个|报错|
||  
|设备路径不在磁盘发现下|报错|
||  
|磁盘名超过31字符|报错|
||  
|磁盘路径无权限、不存在|报错|
||保存按钮|执行保存|保存正常|
|3.数据库节点配置信息——节点配置-ceg1 +按钮/ceg1-1 删除按钮（增加/删除集群内节点）|新增节点-所在主机|勾选主机列表中的主机ip，与已有节点ip不重复|成功|
|  
|  
|勾选主机列表中的主机ip，与已有节点ip重复|报错|
|![](https://pingcode.yasdb.com/atlas/files/public/67396ef88970c2af4f521ccb/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFCQVFBQUFBQUFBRUFBQUFBQWhBQUFBQUFBQUFBQUFBQUFDRUFBQUFBQUNBQUFJQUFBQUFJQUFBQUFBQVFnQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFRQVFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUlBQUFRQUFBSUFBQUFCQUFBQkFBQUFBQUFBQUFBQUFBUVNBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTgwMTEsImV4cCI6MTc4MjQ2ODgxMX0.2PsTlOSR1X_Urhh0yR46A_LOC0VzT7TRahzC98d9aV4)|  
|空值|报错|
||新增节点-节点路径|与原有节点保持一致|成功|
||  
|与原有节点不同，不存在|成功|
||  
|空值、无权限|失败|
||新增节点-角色|与已有节点角色不重复--备节点|成功|
||  
|与已有节点角色重复--主节点|报错|
||新增节点-端口号|端口号已被占用、重复、超出配置范围--同参数测试|  
|
||  
|  
|  
|
||增加集群内节点数（多次执行ceg1 +按钮）|主集群节点数增加至64|正常部署|
||  
|主集群节点数增加至65|报错|
||  
|备集群节点数增加至比主集群多|报错|
||删除节点|删除至只剩一个节点|正常部署|
||  
|删除最后一个节点|无法删除|
||  
|多个节点存在时，删除主节点|报错|
||保存按钮|执行保存|保存正常|
|3.数据库节点配置信息——节点配置-新增节点组|节点组数量|个数限制：33-已添加节点组|正常部署|
|  
|节点数量|小于等于主集群节点数|成功|
|  
|  
|大于主集群节点数|报错|
|  
|起始端口|同参数测试|  
|
|  
|节点默认路径、磁盘路径|同参数测试|  
|
|  
|保存按钮|执行保存|保存正常|
|3.数据库节点配置信息——节点配置-删除节点组|删除备集群|删除至只剩主集群|正常部署|
|  
|  
|删除主集群|不能删除|
|  
|保存按钮|执行保存|保存正常|
|4.数据库建库参数|使用建库SQL|修改建库sql|成功|
|![](https://pingcode.yasdb.com/atlas/files/public/67396ef88970c2af4f521ccc/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFCQVFBQUFBQUFBRUFBQUFBQWhBQUFBQUFBQUFBQUFBQUFDRUFBQUFBQUNBQUFJQUFBQUFJQUFBQUFBQVFnQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFRQVFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUlBQUFRQUFBSUFBQUFCQUFBQkFBQUFBQUFBQUFBQUFBUVNBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTgwMTEsImV4cCI6MTc4MjQ2ODgxMX0.2PsTlOSR1X_Urhh0yR46A_LOC0VzT7TRahzC98d9aV4)|  
|建库sql中有错误|报错|
||集群类型数据库YFS参数配置|参数名称、描述按关键词搜索|正常|
||  
|参数移入、移出|  
|
||  
|按照参数取值范围设置参数|  
|
||集群类型数据库YCS参数配置|参数名称、描述按关键词搜索|正常|
||  
|参数移入、移出|正常|
||  
|按照参数取值范围设置参数，超出取值范围/非法字符报错|  
|
||保存按钮|执行保存|保存正常|
|5.数据库节点参数|节点参数配置|参数根据取值范围设置|正常|
|![](https://pingcode.yasdb.com/atlas/files/public/67396ef8a1ad9a3311dc9b40/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFCQVFBQUFBQUFBRUFBQUFBQWhBQUFBQUFBQUFBQUFBQUFDRUFBQUFBQUNBQUFJQUFBQUFJQUFBQUFBQVFnQUFBQUFBQUFBQUFBQUFBQUNBQUFBQUFRQVFBQUFBQUFBSUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUlBQUFRQUFBSUFBQUFCQUFBQkFBQUFBQUFBQUFBQUFBUVNBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTgwMTEsImV4cCI6MTc4MjQ2ODgxMX0.2PsTlOSR1X_Urhh0yR46A_LOC0VzT7TRahzC98d9aV4),  
    
    
    
|  
|参数超出取值范围|报错|
||  
|参数不按要求设置|报错|
||  
|移出、移入|正常|
||  
|同步|正常|
||保存按钮|执行保存|保存正常|
|6.数据库全局信息|快速部署后点击保存并展示数据库详情|查看概览|与设置一致|
|7.部署结果|部署失败，卸载清理|前面部署失败场景|报错正常，清理干净|
|  
|  
|执行不同安装部署阶段，linux中断web服务|重新连接后，重新部署，需要手动清理环境|
|  
|  
|执行不同安装部署阶段，kill集群相关进程|报错正常，清理干净|
|  
|  
|执行不同安装部署阶段，down私网|报错正常，清理环境，故障恢复后，再次清理环境|
|  
|  
|执行不同安装部署阶段，down存储网|报错正常，清理环境，故障恢复后，再次清理环境|
|  
|  
|执行不同安装部署阶段，其中一台机器reboot、断电、halt -p|报错正常，清理环境，故障恢复后，再次清理环境|


# 4. 测试用例

详细文本用例使用excell记录，测试完成后上传。

冒烟用例：

1、安装集群单机2实例、2机2实例成功；

2、安装主备集群多机2实例的一主两备成功；

3、节点管理：增减节点组及增减节点功能正常；

4、安装失败时，卸载清理功能正常，重新部署成功。

# 5. 测试框架设计

目前该测试用例无法自动化，无新增框架设计。

  


## Attachments: