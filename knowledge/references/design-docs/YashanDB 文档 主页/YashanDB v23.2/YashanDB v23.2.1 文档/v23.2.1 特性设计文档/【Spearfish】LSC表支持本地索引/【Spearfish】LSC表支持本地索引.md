Created by 陈宜顺, last modified on 十月 15, 2024

#   [【Spearfish】LSC表支持本地索引](#spearfishlsc表支持本地索引)  

JIRA：[    [YDBRD-21506] LSC表支持本地索引](https://jira.yasdb.com/browse/YDBRD-21506)  

##   [1. Overview（概述）](#1-overview概述)  

LSC需要支持本地索引，支持DN扩缩容时，索引随数据一起迁移

##   [2. Features（功能特性）](#2-features功能特性)  

1. LSC支持Create index语法
1. LSC支持Alter index语法
1. LSC支持Drop index语法
1. LSC表支持使用USING INDEX语法为唯一键指定本地索引，指定形式包括行内（inline_constraint）和行外（out_of_line_constraint）两种方式指定
1. 允许KEEP INDEX语法
1. 转测范围：单机、分布式


##   [3. Interfaces（接口）](#3-interfaces接口)  

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

1. 见详细设计


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Create index](#51-create-index)  

支持Create Index语法，规格约束包括：

- 支持唯一索引、分区索引（本地索引，包含一级分区、二级分区场景），不支持创建RTREE索引、列式索引、非唯一索引、函数索引、反向索引
- 允许VISIBLE/INVISIBLE
- 允许USABLE/UNUSABLE
- 允许并行创建索引
- 允许COMPRESS/NOCOMPRESS
- LOGGING/NOLOGGING行为与行表一致
- 允许readonly、inmemory字句
- 不允许ONLINE
- 分布式下不允许分区表建Global索引


###   [5.2 Alter index](#52-alter-index)  

支持Alter Index语法，规格约束包括：

- 修改VISIBLE、INITRANS、USABLE、PARALLEL、LOGGING属性
- 支持COALESCE操作
- 支持REBUILD操作，但是不允许REBUILD ONLINE
- 支持modify_partition
- 支持modify_subpartition


###   [5.3 Drop index](#53-drop-index)  

能力与行表/TAC表保持一致

###   [5.4 使用USING INDEX语法](#54-使用using-index语法)  

USING INDEX语法在CREATE TABLE和ALTER TABLE中都可以使用，能力与行表/TAC表保持一致

添加/删除唯一性约束的语法与行表/TAC表保持一致。

###   [5.5 Alter table modify constraint](#55-alter-table-modify-constraint)  

- 允许KEEP INDEX语法


###   [5.6 分布式处理](#56-分布式处理)  

- 未使用USING INDEX语法时，
    - 分布表创建唯一索引/约束应该默认是本地（LOCAL）的，
    - 复制表行为与单机保持一致
- 使用USING INDEX语法时，
    - 分布表不允许USING INDEX创建Global索引
    - 复制表行为与单机保持一致
- 升级后的扩缩容场景：
    - 存量DN全局索引场景还是报错
    - 后续新建本地索引
- 扩缩容处理：
    - 验证带本地索引的扩缩容场景


##   [6. Testcases（自测用例）](#6-testcases自测用例)  

1. 正常创建索引
1. 创建索引语法异常


##   [7. TODO（遗留问题）](#7-todo遗留问题)  

说明本方案遗留的问题或下一步需要解决的问题。

1. 去除Slice Id map


  


## Comments:

|  [](null)  ,评审纪要：    
  1. 分布表不允许建Global索引，涉及TAC的规格变更    
  2. 创建本地索引行为跟单机有区别，除了用USING INDEX语法创建，默认不指定Global或Local情况下的行为是建LOCAL索引,Posted by chenyishun at 十月 13, 2023 17:16|
|---|
