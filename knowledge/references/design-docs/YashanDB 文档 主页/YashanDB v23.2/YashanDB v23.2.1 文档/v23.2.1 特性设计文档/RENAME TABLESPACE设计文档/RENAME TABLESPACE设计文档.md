Created by 马程飞, last modified on 十一月 13, 2023

SR链接：    [YDBRD-21551](https://jira.yasdb.com/browse/YDBRD-21551?src=confmacro)    -  支持rename tablespace，在线重命名表空间  完成

#   [一.Overview (概述)](#一overview-概述)  

用户创建错误或者需要重新规划表空间名称时可以使用RENAME重命名表空间，不需要重建表空间。

#   [二.Features(功能特性)](#二features功能特性)  

- RENAME TABLESPACE仅会修改表空间名称，不会修改表空间ID
- RENAME TABLESPACE会更新数据库中所有对表空间名引用，包括控制文件、数据字典


#   [三.Interfaces(接口)](#三interfaces接口)  

  `ALTER TABLESPACE space_old_name RENAME TO space_new_name;`  

#   [四.Specification And Constraints (规格与约束)](#四specification-and-constraints-规格与约束)  

- 不能重命名内置表空间
- 不能重命名OFFLINE表空间
- 不能重命名为已存在的表空间


#   [五.Detail Design(详细设计)](#五detail-design详细设计)  

- 根据语法解析表空间新旧名称
- 加锁校验是否新名称表空间已存在，存在则报错
- 判断是否为内置表空间或OFFLINE表空间，如果是则报错
- 记录RENAME SPACE日志
- 修改控制文件中的表空间名称为新名称


#   [六.Testcases(自测用例）](#六testcases自测用例)  

- CREATE TABLESPACE MCF DATAFILE 'MCF' SIZE 10M;
- ALTER TABLESPACE MCF RENAME TO MACF;
- SELECT * FROM V$TABLESPACE WHERE NAME = ‘MACF';


#   [七.资料设计章节](#七资料设计章节)  

- 涉及ALTER TABLESPACE语法资料添加


#   [八 TODO （遗留问题）](#八-todo-遗留问题)  

## Comments:

|  [](null)  ,1.排查数据字典中对表空间名的引用、SLICE相关的系统表,2.表空间迁移是否有影响,3.拦截分布式RENAME SPACE,4.集群上处理旧名称的引用，失效,5.删除spacem->indexArray,  
,Posted by zhengquan at 十一月 14, 2023 15:27|
|---|
|  [](null)  ,参与人员：马志宏、陆世杰、朱国旭、郑荃,  
,评审意见：,1.排查数据字典中对表空间名的引用、SLICE相关的系统表,2.评估表空间迁移是否有影响,3.拦截分布式RENAME SPACE,4.集群上处理旧名称的引用，失效,5.删除spacem->indexArray（表空间优化）,Posted by machengfei at 十二月 11, 2023 19:49|
