Created by 吕雷奇, last modified on 十月 15, 2024

SR链接：       [YDBRD-21722](https://jira.yasdb.com/browse/YDBRD-21722?src=confmacro)    -  支持本地swap表空间  完成

开发设计文档：    [集群支持本地SWAP表空间详细设计 - YashanDB - SICS-CoD Confluence (yasdb.com)](https://conf.yasdb.com/pages/viewpage.action?pageId=141578780)  

# 1. 概述

支持本地swap表空间主要为了解决集群下使用swap表空间的性能问题；

本特性支持了集群下本地swap表空间的创建、修改和删除的功能，单机下swap表空间的创建、修改和删除的功能；

# 2. 需求分析

## 2.1 功能点分析

- *对功能/需求进行详细说明及分析，*  *对应提供的功能点、函数、语法图、配置参数、视图、接口等；*
- *开发设计的主要原理*


2.1.1支持创建本地临时表语法图：

![](https://pingcode.yasdb.com/atlas/files/public/67396bd5a1ad9a3311dc85ae/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFCQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBRUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQWdnQUFBQUFBQUFBQUFKQWdBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBRUFBQUFRQUVBRWdBUUFBQUFBQUFBQUFBQUFBQWlBZ0FBQUFBQUFBQUFnQUFBQUFRQUFBQUNBQUFBQUNBQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTczNDYsImV4cCI6MTc4MjMwODE0Nn0.zFiM1E0jQ9Pe6zrUYNasHP4Y8L2mS4nbk9yYYaG5HgM)

2.1.2更改删除swap表空间SQL

![](https://pingcode.yasdb.com/atlas/files/public/67396bd58970c2af4f52073c/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFCQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBRUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQWdnQUFBQUFBQUFBQUFKQWdBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBRUFBQUFRQUVBRWdBUUFBQUFBQUFBQUFBQUFBQWlBZ0FBQUFBQUFBQUFnQUFBQUFRQUFBQUNBQUFBQUNBQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTczNDYsImV4cCI6MTc4MjMwODE0Nn0.zFiM1E0jQ9Pe6zrUYNasHP4Y8L2mS4nbk9yYYaG5HgM)

2.1.3 删除swap表空间

![](https://conf.yasdb.com/download/attachments/133584601/image2023-11-16_15-42-6.png?version=1&modificationDate=1700120376000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFCQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBRUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQWdnQUFBQUFBQUFBQUFKQWdBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBRUFBQUFRQUVBRWdBUUFBQUFBQUFBQUFBQUFBQWlBZ0FBQUFBQUFBQUFnQUFBQUFRQUFBQUNBQUFBQUNBQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTczNDYsImV4cCI6MTc4MjMwODE0Nn0.zFiM1E0jQ9Pe6zrUYNasHP4Y8L2mS4nbk9yYYaG5HgM)

  


相关视图：

dba_temp_files,dba_temp_free_space;

user_tablespace,dba_tablespace 有新增列 shared 标识 表空间文件是local （for leaf or for all）或者shared;

dba_temp_files 扩展了两列 shared 和 inst_id,inst_id 列包含实例number，对于共享swap表空间，每个文件只有一行，同时inst_id 为null，对于本地swap表空间，包含没有实例上的swap表空间文件；

dba_temp_free_space 扩展了两列 shared 和 inst_id, 显示信息同上；

## 2.2 应用场景

- *需求本身的主要应用场景*
- *需求与其他特性的关联场景*


*支持的场景*

|  
|场景描述|语法图|备注|
|---|---|---|---|
|1|支持创建swap表空间|![](https://pingcode.yasdb.com/atlas/files/public/67396bd5a1ad9a3311dc85b1/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFCQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBRUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQWdnQUFBQUFBQUFBQUFKQWdBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBRUFBQUFRQUVBRWdBUUFBQUFBQUFBQUFBQUFBQWlBZ0FBQUFBQUFBQUFnQUFBQUFRQUFBQUNBQUFBQUNBQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTczNDYsImV4cCI6MTc4MjMwODE0Nn0.zFiM1E0jQ9Pe6zrUYNasHP4Y8L2mS4nbk9yYYaG5HgM)|单机不支持创建local swap 表空间，  可以创建SWAP TABLESPACE  ；,  
,  
|
|2|支持建库时创建swap表空间|![](https://conf.yasdb.com/download/attachments/138570420/image2023-12-22_11-38-53.png?version=1&modificationDate=1703216333000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFCQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBRUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQWdnQUFBQUFBQUFBQUFKQWdBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBRUFBQUFRQUVBRWdBUUFBQUFBQUFBQUFBQUFBQWlBZ0FBQUFBQUFBQUFnQUFBQUFRQUFBQUNBQUFBQUNBQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTczNDYsImV4cCI6MTc4MjMwODE0Nn0.zFiM1E0jQ9Pe6zrUYNasHP4Y8L2mS4nbk9yYYaG5HgM)|单机下支持建swap表空间，集群下不支持建库时创建swap表空间|
|3|支持修改（本地）swap表空间大小|![](https://conf.yasdb.com/download/attachments/138570420/image2023-12-22_11-4-31.png?version=1&modificationDate=1703214271000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFCQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBRUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQWdnQUFBQUFBQUFBQUFKQWdBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBRUFBQUFRQUVBRWdBUUFBQUFBQUFBQUFBQUFBQWlBZ0FBQUFBQUFBQUFnQUFBQUFRQUFBQUNBQUFBQUNBQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTczNDYsImV4cCI6MTc4MjMwODE0Nn0.zFiM1E0jQ9Pe6zrUYNasHP4Y8L2mS4nbk9yYYaG5HgM),![](https://conf.yasdb.com/download/attachments/138570420/image2023-12-22_11-35-43.png?version=1&modificationDate=1703216144000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFCQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBRUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQWdnQUFBQUFBQUFBQUFKQWdBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBRUFBQUFRQUVBRWdBUUFBQUFBQUFBQUFBQUFBQWlBZ0FBQUFBQUFBQUFnQUFBQUFRQUFBQUNBQUFBQUNBQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTczNDYsImV4cCI6MTc4MjMwODE0Nn0.zFiM1E0jQ9Pe6zrUYNasHP4Y8L2mS4nbk9yYYaG5HgM)|单机支持，集群不支持？|
|4|修改数据库默认swap表空间|![](https://conf.yasdb.com/download/attachments/138570420/image2023-12-22_11-37-13.png?version=1&modificationDate=1703216234000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFCQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBRUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQWdnQUFBQUFBQUFBQUFKQWdBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBRUFBQUFRQUVBRWdBUUFBQUFBQUFBQUFBQUFBQWlBZ0FBQUFBQUFBQUFnQUFBQUFRQUFBQUNBQUFBQUNBQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTczNDYsImV4cCI6MTc4MjMwODE0Nn0.zFiM1E0jQ9Pe6zrUYNasHP4Y8L2mS4nbk9yYYaG5HgM)|暂不支持，当前不支持数据库级别默认swap表空间|
|5|创建用户指定本地swap表空间|![](https://conf.yasdb.com/download/attachments/138570420/image2023-12-22_11-59-41.png?version=1&modificationDate=1703217581000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFCQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBRUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQWdnQUFBQUFBQUFBQUFKQWdBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBRUFBQUFRQUVBRWdBUUFBQUFBQUFBQUFBQUFBQWlBZ0FBQUFBQUFBQUFnQUFBQUFRQUFBQUNBQUFBQUNBQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTczNDYsImV4cCI6MTc4MjMwODE0Nn0.zFiM1E0jQ9Pe6zrUYNasHP4Y8L2mS4nbk9yYYaG5HgM)|暂不支持，以下sr适配,  [YDBRD-23462](https://jira.yasdb.com/browse/YDBRD-23462?src=confmacro)    -  创建用户支持指定临时表空间  冒烟测试|
|6|修改用户的本地swap表空间|![](https://conf.yasdb.com/download/attachments/138570420/image2023-12-22_12-0-24.png?version=1&modificationDate=1703217625000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFCQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBRUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQWdnQUFBQUFBQUFBQUFKQWdBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBRUFBQUFRQUVBRWdBUUFBQUFBQUFBQUFBQUFBQWlBZ0FBQUFBQUFBQUFnQUFBQUFRQUFBQUNBQUFBQUNBQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTczNDYsImV4cCI6MTc4MjMwODE0Nn0.zFiM1E0jQ9Pe6zrUYNasHP4Y8L2mS4nbk9yYYaG5HgM)|暂不支持，以下sr适配,  [YDBRD-23462](https://jira.yasdb.com/browse/YDBRD-23462?src=confmacro)    -  创建用户支持指定临时表空间  冒烟测试|
|7|修改本地swap表空间文件为offline|![](https://conf.yasdb.com/download/attachments/138570420/image2023-12-22_12-2-19.png?version=1&modificationDate=1703217739000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFCQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBRUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQWdnQUFBQUFBQUFBQUFKQWdBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBRUFBQUFRQUVBRWdBUUFBQUFBQUFBQUFBQUFBQWlBZ0FBQUFBQUFBQUFnQUFBQUFRQUFBQUNBQUFBQUNBQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTczNDYsImV4cCI6MTc4MjMwODE0Nn0.zFiM1E0jQ9Pe6zrUYNasHP4Y8L2mS4nbk9yYYaG5HgM)|暂不支持？|
|8|shrink本地swap表空间|![](https://conf.yasdb.com/download/attachments/138570420/image2023-12-22_12-3-1.png?version=1&modificationDate=1703217782000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFCQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBRUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQWdnQUFBQUFBQUFBQUFKQWdBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBRUFBQUFRQUVBRWdBUUFBQUFBQUFBQUFBQUFBQWlBZ0FBQUFBQUFBQUFnQUFBQUFRQUFBQUNBQUFBQUNBQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTczNDYsImV4cCI6MTc4MjMwODE0Nn0.zFiM1E0jQ9Pe6zrUYNasHP4Y8L2mS4nbk9yYYaG5HgM)|暂不支持？|
|9|修改本地swap表空间的auto-extension|![](https://conf.yasdb.com/download/attachments/138570420/image2023-12-22_12-3-45.png?version=1&modificationDate=1703217826000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFCQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBRUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQWdnQUFBQUFBQUFBQUFKQWdBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBRUFBQUFRQUVBRWdBUUFBQUFBQUFBQUFBQUFBQWlBZ0FBQUFBQUFBQUFnQUFBQUFRQUFBQUNBQUFBQUNBQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTczNDYsImV4cCI6MTc4MjMwODE0Nn0.zFiM1E0jQ9Pe6zrUYNasHP4Y8L2mS4nbk9yYYaG5HgM)|  
|
|10|resize本地swap表空间|![](https://conf.yasdb.com/download/attachments/138570420/image2023-12-22_12-4-12.png?version=1&modificationDate=1703217853000&api=v2?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFCQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBRUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQWdnQUFBQUFBQUFBQUFKQWdBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBRUFBQUFRQUVBRWdBUUFBQUFBQUFBQUFBQUFBQWlBZ0FBQUFBQUFBQUFnQUFBQUFRQUFBQUNBQUFBQUNBQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTczNDYsImV4cCI6MTc4MjMwODE0Nn0.zFiM1E0jQ9Pe6zrUYNasHP4Y8L2mS4nbk9yYYaG5HgM)|暂不支持|
|11|rename 本地swap表空间|![](https://pingcode.yasdb.com/atlas/files/public/67396bd68970c2af4f520743/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFCQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBRUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQWdnQUFBQUFBQUFBQUFKQWdBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBRUFBQUFRQUVBRWdBUUFBQUFBQUFBQUFBQUFBQWlBZ0FBQUFBQUFBQUFnQUFBQUFRQUFBQUNBQUFBQUNBQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTczNDYsImV4cCI6MTc4MjMwODE0Nn0.zFiM1E0jQ9Pe6zrUYNasHP4Y8L2mS4nbk9yYYaG5HgM)|  
|
|12|create swap表空间without datafile|![](https://pingcode.yasdb.com/atlas/files/public/67396bd68970c2af4f520745/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFDQUFCQUFBQUFBQUFBQUFBQUFBQUlBQUFBQUFBRUFBQUFBSUFBQUFBQUFBQUFBQUFBQUFBQWdnQUFBQUFBQUFBQUFKQWdBQUFBQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBRUFBQUFRQUVBRWdBUUFBQUFBQUFBQUFBQUFBQWlBZ0FBQUFBQUFBQUFnQUFBQUFRQUFBQUNBQUFBQUNBQkFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODIyOTczNDYsImV4cCI6MTc4MjMwODE0Nn0.zFiM1E0jQ9Pe6zrUYNasHP4Y8L2mS4nbk9yYYaG5HgM)|  
|


## 2.3 规格约束

- 单机不支持创建LOCAL SWAP TABLESPACE，可以创建SWAP TABLESPACE
- 分布式不支持创建SWAP TABLESPACE和LOCAL SWAP TABLESPACE，只能在建库的时候创建出默认的
- 集群下支持创建LOCAL SWAP TABLESPACE和SWAP TABLESPACE
- 对于能创建出来的SWAP TABLESPACE，均支持ALTER和DROP
- 对于本地表空间，不可以同时指定磁阵文件和本地文件。
- 本地SWAP表空间实例间不能共享，各用各的。
- 只使用用户默认的SWAP表空间，即使空间不足也不跨SWAP表空间
- DROP DATAFILE / SPACE的过程中，需要检测当前DEFAULT_SWAP_TABLESPACE；
-   `ALTER SYSTEM SET DEFAULT_SWAP_TABLESPACE = 表空间名字`    ，这个语句只能在SWAP表空间没有查询业务时切换, 即VM没有正在被使用；
- 切换DEFAULT_SWAP_TABLESPACE 语句可以重启后切换，也可以在线切换；
- 集群可存在多个SWAP表空间，但有且只有一个在实例当中正在被使用；
- 不同的实例可以拥有不同的SWAP表空间；


# 3. 详细测试设计

## 3.1 测试设计方法

*对本测试设计中使用的工程方法及适用的场景分类做说明*

*新增语法图–路径覆盖*

|序号|场景|子项|预期|备注|
|---|---|---|---|---|
|1|创建swap表空间，正常场景|创建本地swap表空间 带for all|正常创建|冒烟用例|
|2|  
|创建本地swap表空间 带for leaf|正常创建|冒烟用例|
|3|创建swap表空间，异常场景报错|创建本地swap表空间 不带local 关键字，带for all|创建失败，报错信息正常|  
|
|4|  
|创建本地swap表空间 不带local 关键字，带for leaf|创建失败，报错信息正常|  
|
|5|  
|创建本地swap表空间 带local 关键字，不带for all | for leaf|创建失败，报错信息正常|  
|
|6|  
|创建本地swap表空间 带local 关键字，带for， 不带all |  leaf|创建失败，报错信息正常|  
|
|7|  
|关键字位置错误 local，for ，all，leaf|创建失败，报错信息正常|  
|
|8|更改删除swap表空间文件|--|--|沿用之前的功能，语法不用再覆盖|
|9|删除swap表空间|--|--|沿用之前的功能，语法不用再覆盖|


*应用场景要覆盖-- 场景法*

*功能场景*

|序号|场景|预期|备注|
|---|---|---|---|
|1|单机下，创建swap表空间 ，修改默认swap表空间为自定义的swap表空间，查看dba_temp_files ，dba_tablespace，dba_temp_free_space？|创建成功，可以查看到对应视图字段增加和变更|冒烟用例|
|2|单机HA下，创建swap表空间 ，修改默认swap表空间为自定义的swap表空间，查看dba_temp_files ，dba_tablespace，dba_temp_free_space？|创建成功，可以查看到对应视图字段增加和变更|冒烟用例|
|3|集群下，创建本地swap表空间 ，修改默认swap表空间为自定义的本地swap表空间，查看dba_temp_files ，dba_tablespace，dba_temp_free_space？|创建成功，可以查看到对应视图字段增加和变更|冒烟用例|
|4|单机下，创建swap表空间 ，drop 自定义swap表空间成功|创建成功，可以查看到对应视图字段增加和变更|冒烟用例|
|5|单机HA下，创建swap表空间 ，drop 自定义swap表空间成功|创建成功，可以查看到对应视图字段增加和变更|冒烟用例|
|6|集群下，创建本地swap表空间，drop 自定义本地swap表空间成功|创建成功，可以查看到对应视图字段增加和变更|冒烟用例|
|7|单机下，创建swap表空间 ，修改默认swap表空间为自定义的swap表空间，触发swap换入换出场景|创建成功，可以查看到对应视图字段增加和变更|冒烟用例|
|8|单机HA下，创建swap表空间 ，修改默认swap表空间为自定义的swap表空间，触发swap换入换出场景|修改成功，可以查看到对应视图字段增加和变更|冒烟用例|
|9|集群下，创建local swap表空间 ，修改默认swap表空间为自定义的swap表空间，触发swap换入换出场景|修改成功，可以查看到对应视图字段增加和变更|冒烟用例|


故障类

|序号|场景|预期|备注|
|---|---|---|---|
|1|单机下，创建本地swap表空间for all | for leaf ，在该swap表空间上创建私有临时表和全局临时表，kill yasdb实例，再次拉起|可以看到全局临时表的表定义|  
|
|2|单机下，创建本地swap表空间for all | for leaf  和 kill（shutdown inmmediate） yasdb 的并发|环境正常无core|  
|
|3|单机HA下，主节点创建本地swap表空间for all | for leaf  和 kill（shutdown inmmediate） yasdb 的并发，备节点并发查询dba_temp_files ，dba_tablespace，dba_temp_free_space？|环境正常无core|  
|
|4|单机下，创建本地swap表空间for all | for leaf ，在该swap表空间上创建私有临时表和全局临时表，增加swap表空间文件 操作和  kill（shutdown inmmediate） yasdb 的并发|环境正常无core|  
|
|5|单机下，创建本地swap表空间for all | for leaf ，在该swap表空间上创建私有临时表和全局临时表，增加swap表空间文件，删除表空间 操作和  kill（shutdown inmmediate） yasdb 的并发|环境正常无core|  
|
|6|两实例集群下，master实例创建本地swap表空间for all | for leaf  和master实例启停并发|环境正常无core|  
|
|7|两实例集群下，master实例创建本地swap表空间for all | for leaf  和master实例kill 后重新拉起并发|环境正常无core|  
|
|8|两实例集群下，master实例创建本地swap表空间for all | for leaf  和非master实例启停并发|环境正常无core|  
|
|9|两实例集群下，master实例创建本地swap表空间for all | for leaf  和kill非master实例 后重新拉起并发|环境正常无core|  
|
|10|两实例集群下，master实例创建本地swap表空间for all | for leaf，在该swap表空间上创建私有临时表和全局临时表，增加swap表空间文件 操作 和master实例启停并发|环境正常无core，无卡住|  
|
|11|两实例集群下，master实例创建本地swap表空间for all | for leaf，在该swap表空间上创建私有临时表和全局临时表，增加swap表空间文件 操作 和master实例kill 后重新拉起并发|环境正常无core，无卡住|  
|
|12|两实例集群下，master实例创建本地swap表空间for all | for leaf，在该swap表空间上创建私有临时表和全局临时表，增加swap表空间文件 操作 和非master实例启停并发|环境正常无core，无卡住|  
|
|13|两实例集群下，master实例创建本地swap表空间for all | for leaf，在该swap表空间上创建私有临时表和全局临时表，增加swap表空间文件 操作 和kill非master实例 后重新拉起并发|环境正常无core，无卡住|  
|
|14|两实例集群下，master实例创建本地swap表空间for all | for leaf，在该swap表空间上创建私有临时表和全局临时表，增加swap表空间文件，drop 表空间 操作 和master实例启停并发|环境正常无core，无卡住|  
|
|15|两实例集群下，master实例创建本地swap表空间for all | for leaf，在该swap表空间上创建私有临时表和全局临时表，增加swap表空间文件，drop 表空间 操作 和master实例kill 后重新拉起并发|环境正常无core，无卡住|  
|
|16|两实例集群下，master实例创建本地swap表空间for all | for leaf，在该swap表空间上创建私有临时表和全局临时表，增加swap表空间文件，drop 表空间 操作 和非master实例启停并发|环境正常无core，无卡住|重复|
|17|两实例集群下，master实例创建本地swap表空间for all | for leaf，在该swap表空间上创建私有临时表和全局临时表，增加swap表空间文件，drop 表空间 操作 和kill非master实例 后重新拉起并发|环境正常无core，无卡住|重复|


性能场景

|序号|场景|预期|备注|
|---|---|---|---|
|1|单机下，创建本地swap表空间for all | for leaf，使用该表空间创建创建私有临时表和全局临时表，插入10W条数据性能|使用本地临时表插入性能不降低（性能差不多）|  
|
|2|单机下，创建本地swap表空间for all | for leaf，使用该表空间创建创建私有临时表和全局临时表，10W条数据的（超过内存配置，有换入换出） 排序查询性能|使用本地临时表查询性能不降低|先不测，vm_buffer_pool调小|
|3|单机下，创建本地swap表空间for all | for leaf，使用该表空间创建创建私有临时表和全局临时表，delete 10W条数据的性能|使用本地临时表delete性能不降低|  
|
|4|单机下，创建本地swap表空间for all | for leaf，使用该表空间创建创建私有临时表和全局临时表，10W条数据的统计信息收集 性能|使用本地临时表统计信息收集性能不降低|先不测，vm_buffer_pool调小|
|5|两实例集群下，创建本地swap表空间for all | for leaf，使用该表空间创建创建私有临时表和全局临时表，插入10W条数据性能|使用本地临时表插入性能明显提升|  
|
|6|两实例集群下，创建本地swap表空间for all | for leaf，使用该表空间创建创建私有临时表和全局临时表，10W条数据的 （超过内存配置，有换入换出）查询性能|使用本地临时表插入性能明显提升|先不测，vm_buffer_pool调小|
|7|两实例集群下，创建本地swap表空间for all | for leaf，使用该表空间创建创建私有临时表和全局临时表，delete 10W条数据的性能|使用本地临时表插入性能明显提升|  
|
|8|两实例集群下，创建本地swap表空间for all | for leaf，使用该表空间创建创建私有临时表和全局临时表，10W条数据的统计信息收集 性能|使用本地临时表插入性能明显提升|先不测，vm_buffer_pool调小|


长稳

|序号|场景|预期|备注|
|---|---|---|---|
|1|单机下，创建本地swap表空间for all | for leaf，使用该表空间创建创建私有临时表和全局临时表，插入10W条数据，（超过内存配置，有换入换出） 排序查询，然后delete数据，再删表，再次使用该表空间创建临时表，重复上述过程|内存不会持续上涨（没有内存泄漏）|  
|
|2|集群下，创建本地swap表空间for all | for leaf，使用该表空间创建创建私有临时表和全局临时表，插入10W条数据，（超过内存配置，有换入换出） 排序查询，然后delete数据，再删表，再次使用该表空间创建临时表，重复上述过程|内存不会持续上涨（没有内存泄漏）|  
|


  


## 3.2 详细测试设计

|系统级DFX分类|是否涉及|
|:---|:---|
|CT|涉及|
|KT|涉及|
|长稳|涉及|
|一致性|不涉及|
|三方测试工具    
  (sqltest，sqlancer)|涉及|
|安全|不涉及|
|DFR|不涉及|
|HA|涉及|
|压力|不涉及|
|性能|涉及|
|可维护性|不涉及|


  


# 4. 测试用例

1. 测试设计评审时提供冒烟文本用例；
1. 启动测试之前提供文本用例，并完成大部分自动化用例；


详见附件

# 5. 测试框架设计

- *如果用例不能实现自动化需要在此标注并说明原因*
- *确认使用的测试框架及其满足度*


# 6. 测试环境说明

*测试环境的相关说明，包括但不限于操作系统，环境配置，辅助测试工具等*

# 7. 工作量评估

工作量：  *xx人天*

计划测试完成时间：

## Attachments:

[error.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczOTZiZDU4OTcwYzJhZjRmNTIwNzM0IiwicmVmX2lkIjoiNjczOTZiZDU1OTNmOTljOWZmMjM2NzdjIiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyMjk3MzQ2LCJleHAiOjE3ODIzODM3NDZ9.VJKEjOt2oF8nBoCxZxXrIG_HfqY4WRWD1INM0KAYVoE)

 (image/svg+xml)    
