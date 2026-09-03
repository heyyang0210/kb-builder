Created by 江祉涵, last modified by  未知用户 (public1) on 六月 14, 2023

#   [1. Overview（概述）](#1-overview概述)  

对于系统表有些未在创建时指定对应的objectId，此次修改将会将所有系统表在创建时指定objectId。

#   [2. Features（功能特性）](#2-features功能特性)  

对于新建库，再建库时之前未指定objectId的系统表在创建时指定系统表，id从200开始。对于更新上来的库，如未指定objectId的系统表已经存在，则将其objectId在起库时存入内存。

##   [3. Interfaces（接口）](#3-interfaces接口)  

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

- 对于更新上来的数据库，若未指定objectId的系统表已存在则无法修改改系统表的oid，只能沿用其生成的oid


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

##   [6. Testcases（自测用例）](#6-testcases自测用例)  

*设计开发人员自测用例（文字描述）。*

##   [7. Workload（工作量）](#7-workload工作量)  

*评估代码量KLOC、工作量（人天）。*

##   [8. TODO（遗留问题）](#8-todo遗留问题)  

后续支持通过SQL语句手动扩展undo segment