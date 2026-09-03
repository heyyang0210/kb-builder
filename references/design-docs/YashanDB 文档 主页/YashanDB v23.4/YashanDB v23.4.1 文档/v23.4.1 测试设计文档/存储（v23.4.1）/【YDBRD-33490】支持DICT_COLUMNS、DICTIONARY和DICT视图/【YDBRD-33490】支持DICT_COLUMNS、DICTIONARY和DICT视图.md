﻿﻿﻿﻿﻿﻿﻿

# 1. 概述

DICT是DICTIONARY的同义词

DICTIONARY记录了系统视图与系统同义词信息，相当于all_views和all_synonyms中展示的内置view和同义词，即数据库创建就拥有的。

DICT_COLUMNS记录了上述DICTIONARY视图的列信息

# 2. 需求分析

## 2.1 功能点分析

1. 支持DICT_COLUMNS、DICTIONARY和DICT视图


```
SQL> desc DICT_COLUMNS
 Name                                      Null?    Type
 ----------------------------------------- -------- ----------------------------
 TABLE_NAME                                         VARCHAR2(128)
 COLUMN_NAME                                        VARCHAR2(128)
 COMMENTS                                           VARCHAR2(4000)

SQL> desc DICTIONARY
 Name                                      Null?    Type
 ----------------------------------------- -------- ----------------------------
 TABLE_NAME                                         VARCHAR2(128)
 COMMENTS                                           VARCHAR2(4000)

SQL> desc DICT
 Name                                      Null?    Type
 ----------------------------------------- -------- ----------------------------
 TABLE_NAME                                         VARCHAR2(128)
 COMMENTS                                           VARCHAR2(4000)
```

1. DICT视图系列显示范围：内置系统视图，通过同义词访问的内置视图（例如动态视图）
1. 视图权限：


    USER_XXX, ALL_XXX 为所有用户可见的视图

    DBA视图，部分动态视图，部分其他视图：sys可见，DBA角色可见

    有对应视图可见性的，可以在DICT视图内查到对应记录。

1. 拥有对特定视图的对象级权限, 例：grant select on dba_users to u1; grant update on dba_users to u1;
1. 拥有select any table，read any table, update any table, delete any table等系统级表访问权限的。但是对于sys下的对象除外，意味着要对sys下对象可见，如dba视图，只能通过对象级权限授予。


## 2.2 应用场景

查看表的comments，和列的comments。

## 2.3 规格约束

﻿1.

DICT系列视图包含两部分，内置系统视图，通过同义词访问的内置视图（例如动态视图）

1. 查询视图相关系统表，过滤出内置视图，关联com$系统表，返回视图名称/视图列名称和对应comment
1. 查询同义词相关系统表，过滤出通过同义词访问的内置视图，并且该同义词和视图不同名，返回同义词名称和comment：synonyms for xxx视图。


由于动态视图均通过公共同义词访问，而不是通过背后真正的视图名称访问，例如v$datafiles对应的视图为v_$datafile，一般我们不访问v_$datafile。

所以不展示形如v_$datafile，x_$，gv_$等视图，而是通过同义词的方式展示v$datafile Synonyms for v_$datafile。

目前v$dual是个例外，会展示两条记录

DUAL    Synonyms for v$dual

v$dual  it's comment

所以DICT视图不会单独展示v_$datafile此类动态视图，而是展示v$datafile， synonyms for v$_datafile;

DICT_COLUMNS视图展示内容即上述DICT视图展示的视图对应列信息。



不同用户查询DICT系列视图的结果，以DICTIONARY为例

USER_XXX, ALL_XXX为所有人可见的视图，所有人都可在DICT视图中查到这些视图的信息

DBA视图，部分动态视图，部分其他视图，按照一下规则判断是否可见

1. 当前用户为该视图OWNER，一般来说内置视图的owner都为sys，因此sys都可见。
1. DBA角色用户
1. 有对应视图可见性的，可以在DICT视图内查到对应记录。
    1. 拥有对特定视图的对象级权限, 例：grant select on dba_users to u1; grant update on dba_users to u1;
    1. 拥有select any table，read any table, update any table, delete any table等系统级表访问权限的。但是对于sys下的对象除外，意味着要对sys下对象可见，如dba视图，只能通过对象级权限授予




# 3. 详细测试设计

## 3.1 测试设计方法

主要采用等价类划分，场景法、错误推测法组合进行设计

## 3.2 详细测试设计

1.功能测试分析





||||||
|---|---|---|---|---|
|覆盖对象|一级分类|有效等价类|无效等价类|备注|
|对象|表|全局临时表|私有临时表|﻿  
|
|﻿  
|视图|DBA,ALL,USER动态视图，系统表，自定义视图，通过同义词访问的视图|﻿  
|﻿  
|
|﻿  
|列|支持的正常列|用户自定义列|﻿  
|
|表名|长度128字符，类型varchar2|schema是64个字符+表名是64个字符|﻿  
|﻿  
|
|comments|﻿  
|表和列 comments 小于 4000|comments超过4000个字符|﻿  
|
|﻿  
|﻿  
|﻿  
|comments包含特殊字符|﻿  
|


2.场景测试分析

﻿  


# 4. 测试用例

﻿  








|用例编号|测试内容|预期|备注|
|---|---|---|---|
|2|动态视图，comment 表和列|可以comment，DICTIONARY和DICT_COLUMNS结果显示正确|﻿  
|
|3|DBA视图，USER视图，ALL视图|视图可以comment及查询|﻿  
|
|4|自定义视图|自定义视图可以comment及查询|﻿  
|
|7|comment字段，filter ，函数计算准确|计算正确显示|﻿  
|
|9|存储过程中给多个视图增加comments，超长字符|可以comment成功，查询正常显示|﻿  
|
|10|comments超过4000个字符|超过4000无法comment|﻿  
|
|11|comments含有特殊字符|特殊字符可以显示|﻿  
|
|12|自定义DBA_ USER_ ALL_字段开头视图 或者表|不展示自定义的表|﻿  
|
|13|新增视图升级测试|升级无异常，视图可正常查询|补充升级用例|
|14|dict查询所有可以显示的表，sys用户和dba用户查询|包含内置系统视图，通过同义词访问的内置视图，用户自定义表和视图|﻿  
|
|15|给普通用户select any table，read any table, update any table, delete any table、insert any table等系统级表访问权限的，看不到sys的视图，可以看到mysql特定的视图|只能看到ALL视图，USER视图，以及公共可访问的动态视图|﻿  
|
|16|给普通用户赋特定视图的对象权限，只能看到赋了特定对象权限的视图|用户连接后，可查看对应视图|﻿  
|
|17|给普通用户赋mysql相关视图的对象权限，可以看到附了权限的视图Mysql权限|能看到的能操作，能操作的能看到|﻿  
|
|18|备机的sys,dba用户，普通用户查询到的范围跟主机一致|显示范围和主机一致|﻿  
|


# 5. 测试框架设计

自动化用例，查视图部分的用例上架ytp

# 6. 测试环境说明

|||
|---|---|
|服务器|﻿|
|操作系统|Linux|
|部署|单机、集群|


# 7. 工作量评估

工作量：7人天

1. 特性熟悉+测试调研 – 1天
1. 研发串讲、测试设计+评审 – 1天
1. 测试设计 - 1天
1. 文本用例+功能测试 - 1天
1. 执行用例+测试 - 2天
1. 上车分析 – 1天


计划测试完成时间：2025/01/14