Created by 梁桢灏, last modified by  王若琳 on 四月 24, 2023

#   [lsc适配nologging方案](#lsc适配nologging方案)  

##   [1. Overview（概述）](#1-overview概述)  

在批量数据操作场景下，可以通过nologging的方式来提高效率，降低系统IO负载。但是nologging存在两个明显的问题：

1. 宕机之后无法从 redo恢复数据，存在数据丢失的风险
1. 主备之间无法同步


因此nologging的主要应用场景为数据迁移，原因如下：

1. 有原始的数据集，即使极端情况下，数据库意外宕机，也不存在数据丢失的风向
1. 如果是备份部署形态，数据迁移通常是先进行主机数据导入，然后再build备机，这样效率最高


需要注意的是，nologging并不是完全不产生redo，而是会减少redo的产生量。

导入流程

1. 通过alter table将表的属性设置为nologging
1. 通过导入工具进行批量导入
1. 通过create index nologging建立索引
1. 通过alter table将表的属性置为logging
1. 4.1 若在alter table logging前数据库宕机，重启后需要truncate对应表


##   [2. Features（功能特性）](#2-features功能特性)  

lsc表在适配nologging特性。

##   [3. Interfaces（接口）](#3-interfaces接口)  

##   [4. Limitations（功能限制）](#4-limitations功能限制)  

- 只用于数据迁移场景，不主备同步，需要后建备机
- nologging只对batchinsert生效
- nologging操作完成之后，需要执行一次全量checkpoint，才能保证数据持久性，否则宕机之后存在数据丢失的风险
- 如果checkpoint执行完之前宕机，重启之后数据可能丢失。
- 在checkpoint之后要将table的表重新设为logging，一切标记为nologging的表都是存在数据丢失可能性的表。
- 对于存在备机的场景，无法修改表的nologging属性。


##   [5. Detail Design（详细设计）](#5-detail-design详细设计)  

###   [5.1 Architecture（架构）](#51-architecture架构)  

表dc中存在logging属性，在表设置为nologging情况下，表会在插入时的handler上设置为isNologging状态。在需要记redo和undo的情况下先修改handler中的isNologging状态为logging，后续再修改为isNologging来实现部分函数需要记redo和undo的功能。宕机起库时，nologging的全部表会把dc置为corrupted状态。corrupted状态下该表需要truncate后才可以重新开始业务。

###   [5.1.1 lsc需要记录redo和undo地方](#511-lsc需要记录redo和undo地方)  

Nologging状态需要记录redo和undo为资源申请页面，使得宕机时，drop或者truncate表可以释放页面。而数据页面无需记录undo和redo，宕机后丢失数据需要truncate表重新导入。因此lsc表只需要记录页面申请的redo与undo即可。lsc对应redo与undo记录点：

- 1.创建lsc表的segment操作，记录segment页面申请，需要记录redo与undo，后续可释放资源。
- 2.插入中创建vgd的swd，主要记录热数据swf的元数据，虽然记录swf的元数据对于swd来说是数据页面，但对于释放资源来说，若不记录redo与undo，宕机后数据丢失，将无法释放对应的swf页面资源，因此为了宕机后释放资源，该swd记录的数据页面也需记录redo与undo，即vgd的swd无需进入Nologging状态。
- 3.插入中创建vgd的swf记录热数据，数据页面可以丢失，因此无需记录redo和undo。对于spf来说，Nologging状态状态下该swf行为与tac表相同。
- 4.热转冷创建coral的swd，主要记录冷数据的元数据，本可以根据databucket直接删除对应文件夹可释放对应资源，无需记录undo与redo。但由于swd机制会有更新操作，在更新时可能触发更新冲突导致读取undo进行revert，但没有记录undo，revert失败（行表查询时需要revert报错，但行表不会进行更新，因此查询报错允许），因此coral的swd也需要记录redo和undo。
- 5.热转冷创建coral的coast数据，由后台生成，不需要记录undo，后台任务失败后下次覆盖写。
- 6.后台任务生成写系统表等行为是系统表操作，因此都是logging状态。


###   [5.1.2 swd更新冲突](#512-swd更新冲突)  

目前swd更新冲突会导致读undo问题，是否需要重构swd的更新逻辑？但该更新逻辑会修改swfupdate逻辑，改动可能比较大，而swd记录redo和undo在lsc表插入中应该不是一个很高频的动作，对于lsc插入或导入性能应该影响不大。

###   [5.1.3 nologging对热转冷](#513-nologging对热转冷)  

nologging主要让导入性能提升，但热传冷如果使用vgd模式，后台转换不影响前台的导入到vgd的过程。而rgd直接导入不会走后台转换，后台转换流程个人觉得无需进入nologging状态。

###   [5.1.4 后台任务失败是否会进入corrupted状态](#514-后台任务失败是否会进入corrupted状态)  

后台转换与前台的插入互相不影响，当插入成功后，转换失败时，不代表插入的数据损坏了，而后台swd写系统表的一系列操作不会存在nologging状态，并且swd更新等也会记录undo和redo，因此无需转换失败无需进入corrupted状态。失败的任务由下次重新生成。

###   [5.1.5 创建ac nologging情况下的行为](#515-创建ac-nologging情况下的行为)  

ac的行为与index不同，index会redo和undo减慢插入的性能，但ac是后台，对性能影响不大，是否需要存在nologging功能？

当ac为isNologging情况下，在ac中需要记录segment（释放资源），swd和coral由于与spf中的swd和coral一样，存在更新操作，因此均需要记录undo和redo。后台生成slice文件时记录的undo文件可以不记录，但失败后带来问题：ac转换失败，由于ac不存在覆盖写，失败后会重新分配一个fileId执行，因此如果要不记录slice文件的undo，则需要一个truncate操作来删除残留slice文件，因此需要实现ac truncate的ddl操作（目前ac的truncate是跟随表，没有专门的ac的truncate语法），且ac转换失败后前台不感知，用户不知道是否需要truncate操作。并且后台失败后，对数据无影响，但需要truncate，ac需要truncate，而只有写slice文件时才需要写slice的undo，对性能影响不大，是否有必要？个人觉得该行为对ac性能影响不大，ac不需要适配nologging。

###   [5.1.6 rgd导入](#516-rgd导入)  

rgd导入时，不会走vgd这套，但swd关联的操作也是需要记录redo与undo，在写slice文件时，若不计slice文件的undo，导入错误后需要truncate表。

##   [6. 测试用例](#6-测试用例)  

##   [7. Document（资料）](#7-document资料)  

alter table语法章节中修改lsc无法修改logging属性的描述，如有约束补充在约束说明部分，需要注意不要和tac支持nologging load的文档修改部分冲突

##   [8. Workload（工作量）](#8-workload工作量)  

##   [9. TODO（遗留问题）](#9-todo遗留问题)  