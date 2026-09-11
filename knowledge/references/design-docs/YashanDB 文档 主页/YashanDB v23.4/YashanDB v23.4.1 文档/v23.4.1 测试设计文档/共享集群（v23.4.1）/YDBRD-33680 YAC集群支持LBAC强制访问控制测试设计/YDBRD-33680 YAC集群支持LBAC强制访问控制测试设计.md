Created by 韩晓盼, last modified on 十一月 11, 2024





IR：    [https://pingcode.yasdb.com/ship/ideas/66290744009f91eb87f6bb62](https://pingcode.yasdb.com/ship/ideas/66290744009f91eb87f6bb62)    ?    
  #YASHAN-2864 YAC集群支持LBAC强制访问控制

SR：    [https://pingcode.yasdb.com/pjm/items/67072d60e489dd0868f32b73](https://pingcode.yasdb.com/pjm/items/67072d60e489dd0868f32b73)    ?    
  #YDBRD-33680 YAC集群支持LBAC强制访问控制

# 1.   **概述**

本需求设计范围是YAC集群支持LBAC强制访问控制。

# 2.   **需求分析**

**1、LBAC**

- **定义**


YashanDB Label Security，通过Label-Based Access Control （简称LBAC）一种基于行标签的访问控制，实现了基于策略对数据库中的表提供行级安全控制功能。

- **简介**


LBAC 由策略、组件、标签构成。  策略是一种预定义标记组件，由等级（level)、范围（compartment）和组（group) 构成，从3个不同的维度对数据进行描述，其中等级在策略中是必须存在的，范围和组可以缺省。

![](https://pingcode.yasdb.com/atlas/files/public/673ab6d7ff43ee9c85b216a4/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBSUFBQUFBQUFBQ0JBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUJBQUFBQUFRQUFBQUFCQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUlBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJSUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTgzNjIsImV4cCI6MTc4MjQ2OTE2Mn0.v9wHXTdqOsCEwqjpgUJSEW4tT31_UOj8XBf5A3MdpeE)

标签由等级、范围、组构成，其中等级是必选的，范围和组可以省略。

![](https://pingcode.yasdb.com/atlas/files/public/673ab6d7ff43ee9c85b216a5/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBSUFBQUFBQUFBQ0JBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUJBQUFBQUFRQUFBQUFCQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUlBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJSUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTgzNjIsImV4cCI6MTc4MjQ2OTE2Mn0.v9wHXTdqOsCEwqjpgUJSEW4tT31_UOj8XBf5A3MdpeE)

说明如下：

1. Policy： 就是安全策略，一个安全策略是level，compartment，group，label的集合。
1. Level：  等级，这是最基础的安全控制等级，必须设置。
1. Compartment：范围，提供第二级的安全控制，是可选的。
1. Group：组，提供第三级的安全控制，是可选的。
1. Label：标签，最终体现到每一行上的安全标签，必须设置。只有用户被赋予的标签和此行上的标签相同或者等级更高的时候，该行才能够被用户存取。


- **目前YaShanDB支持能力（单机）**


1、创建删除策略：CREATE POLICY、CREATE POLICY

2、创建删除组件：  CREATE LEVEL、CREATE COMPARTMENT、DROP LEVEL、DROP COMPARTMENT

3、创建删除标签：CREATE LABEL、DROP LABEL

4、表关联取消策略：APPLY TABLE POLICY、REMOVE TABLE POLICY

5、用户关联取消策略：SET USER LABELS、DROP USER ACCESS

6、LBAC开关打开关闭：ENABLE、DISABLE

  


**2、需求来源**

*需求来源*  ：    
  产品化需求 

1、支持强制访问控制    
    
  *场 景*  ：    
  1、通过标签和策略实现对细粒度的权限进行控制    
    
  *需求描述*  ：    
  集群支持强制访问控制    
    


*需求规格*  ： 

1.启动和禁用LBAC 

2.标签管理：支持创建删除标签，标签实现基于Level的标签和基于隔离区（  Compartments  ）的标签，可以设置用户标签，session标签和行标签。 

3.策略管理：支持创建删除策略 

4.用户权限与角色支持：增加安全管理员角色与安全管理员。 

5.安全谓词：根据配置，生成对应的安全谓词。    
    
  *需求范围*  ：    
  1、集群    
  2、行表

  


**3、功能分析**

集群支持LBAC强访问控制。

1）基本功能与单机保持一致。在此基础上，实现集群实例之间LBAC信息能同步。具体单机支持功能参考：    [YDBRD-19095: LBAC 详细设计 - YashanDB 文档 - SICS-CoD Confluence](https://conf.yasdb.com/pages/viewpage.action?pageId=135606670)  

2）规格限制：

- 崖山  一个表只允许关联1个安全策略


# 3.   **测试设计方法**

使用边界值，场景分析等测试方法。

如策略名称、等级值、等级范围等测试使用了边界值测试，策略作用到表上进行dml等测试使用了场景分析法。

# 4.   **详细测试设计**

1）使用章节3的测试方法设计详细的测试点

1、功能测试

基础测试：

|测试点|测试场景|有效类|无效类|备注|
|---|---|---|---|---|
|LBAC开关|sys用户下，打开/关闭开关，执行lbac相关操作|1、（重复）打开，能执行lbac相关操作,2、（重复）关闭，执行相关操作会报错,3、默认开关关闭,4、查看YLS$PROPS、DBA_YLS_STATUS，显示正常,  
|1、lbac相关操作不受开关影响,2、重复打开、关闭失败,3、默认开关打开,4、使用错误语法，报错|相关用例：test_sdv_sr33680_lbac_yac_001|
|  
|非sys用户，但是拥有LBAC_DBA角色的普通DBA用户|同上|同上|相关用例：test_sdv_sr33680_lbac_yac_030|
|  
|非sys用户，普通DBA用户|打开/关闭开关失败|/|  
|
|  
|策略应用到表后，用户访问数据受限，关闭LBAC，则不受限|1、策略应用到表前，插入数据，打开开关，无法访问这些行数据,2、关闭开关，可以访问这些行数据，此时修改表的标签列数据,3、再次打开开关，可以访问表前数据|/|相关用例：test_sdv_sr33680_lbac_yac_036|
|创建策略|入参个数|1，2，3|0，4|1、前提条件：sys用户下，打开开关,2、相关用例：test_sdv_sr33680_lbac_yac_  002|
|  
|策略名长度|<=64|>64|1、字段规格差异：yasdb报错，oracle不报错|
|  
|策略名唯一性|单个，不报错|多个同名，报错|  
|
|  
|策略名类型，参数值|1、字符类型：字母，字母带数值，字母带中文，中文带数值，带特殊符号（_），null，’‘，带双引号,2、procedure、function、表名|1、字符类型：纯数值、其他特殊符号（空格、'null'、%1.2.3#!~()、，。。。），中文字符，报错,2、非字符类型，报错,3、关键字，table、view、index，报错|1、规格差异：oracle不允许策略名为中文|
|  
|策略列名类型，参数值|1、字符类型：字母，字母带数值，字母带中文，中文带数值，带特殊符号（_），null，’‘，带双引号,2、procedure、function、表名|1、字符类型：纯数值、其他特殊符号（空格、'null'、%1.2.3#!~()、，。。。），中文字符，报错,2、非字符类型，报错,3、伪列：rowid、rowscn、rownum，报错|1、规格差异：oracle不允许策略列名为中文|
|  
|default_options入参|1、支持入参值：READ_CONTROL、WRITE_CONTROL、INSERT_CONTROL、DELETE_CONTROL、UPDATE_CONTROL,2、字符类型：null，’‘|1、暂不支持选项：LABEL_DEFAULT、LABEL_UPDATE、CHECK_CONTROL、ALL_CONTROL、NO_CONTROL、HIDE，以上入参值均报错（invalid policy option）,2、字符类型：中文，纯数值、其他特殊符号（空格、'null'、%1.2.3#!~()、，。。。），中文字符，报错,3、非字符类型，报错|1、相关用例：test_sdv_sr33680_lbac_yac_003,2、WRITE_CONTROL= INSERT_CONTROL+ DELETE_CONTROL+ UPDATE_CONTROL,3、READ_CONTROL 相当于控制SELECT、  UPDATE、DELETE操作|
|  
|  
|单个READ_CONTROL，查看对策略表进行 select、delete、update 时有控制，其他操作（insert）无控制|/|  
|
|  
|  
|单个WRITE_CONTROL，查看对策略表进行 insert、delete、update 时有控制，其他操作（select）无控制|/|  
|
|  
|  
|单个INSERT_CONTROL，查看对策略表进行insert时有控制，其他操作（delete、update、select）无控制|/|  
|
|  
|  
|单个DELETE_CONTROL，查看对策略表进行delete时有控制，其他操作（insert、update、select）无控制|/|  
|
|  
|  
|单个UPDATE_CONTROL，查看对策略表进行update时有控制，其他操作（insert、delete、select）无控制|/|  
|
|  
|  
|2个以上入参值：不重复,（1）READ_CONTROL+   WRITE_CONTROL：目前yashan支持最强控制访问,（2）READ_CONTROL+ INSERT_CONTROL/ DELETE_CONTROL/ UPDATE_CONTROL：某些操作不受控制,（3）WRITE_CONTROL+ INSERT_CONTROL/ DELETE_CONTROL/ UPDATE_CONTROL：相当于重复控制，总的来说只有WRITE_CONTROL,（4） INSERT_CONTROL+ DELETE_CONTROL/ UPDATE_CONTROL,DELETE_CONTROL+UPDATE_CONTROL,（5）READ_CONTROL+ WRITE_CONTROL+ INSERT_CONTROL/ DELETE_CONTROL/ UPDATE_CONTROL：yashan支持最强控制访问+重复控制|2个以上入参值：重复，报错,（1）  READ_CONTROL+ WRITE_CONTROL+ INSERT_CONTROL+ INSERT_CONTROL：报错  duplicate   INSERT_CONTROL|  
|
|  
|以上三个参数大小写测试|1、大小测试，无差别（建表时策略名用大写，创建等级、范围时用心小写，能执行成功）,  
|/|  
|
|  
|创建1000及以上个策略|成功|/|1、Oracle会报错，但不是lbac策略的原因，由于Oracle  限制了表或视图中列的最大数量为1000，所以导致创建>1k个策略会失败（测试显示创建到856个就会报错）,2、相关用例：test_sdv_sr33680_lbac_yac_031|
|删除策略|入参个数|1，2|0，3|相关用例：test_sdv_sr33680_lbac_yac_002|
|  
|策略名类型，参数值（参数一）|1、字符类型：字母，字母带数值，字母带中文，中文带数值，带特殊符号（_），null，’‘，带双引号,2、procedure、function、表名|1、字符类型：策略名不存在，报错；,2、字符类型：纯数值、其他特殊符号（空格、'null'、%1.2.3#!~()、，。。。），中文字符，报错（与上面报错不一样）,3、非字符类型，报错,4、伪列：rowid、rowscn、rownum，报错|  
|
|  
|参数值（参数二）|1、true or false or 其他可以转为布尔的数值型 or 特殊字符型（  'true'、't'、 'yes'、 'y'、 'on'、 '1'、'false'、'f'、 'no'、 'n'、 'off'、 '0'  ）,2、存在该参数，true显示删除标签列；false显示没有删除标签列；,不存在该参数（为空），默认fasle， 显示没有删除标签列|1、其他值报错|  
|
|  
|+label|1、策略被label使用，可以删除成功；未被使用，可与删除成功,  
|/|  
|
|创建等级|入参个数|4|0~3，5|相关用例：test_sdv_sr33680_lbac_yac_004|
|  
|level_num值|1、400>300>200（值越大，控制范围越大）,2、同一策略下，不同level_num,3、不同一策略下，相同level_num,4、边界值，0，9999,5、带小数点、二进制、数值字符的等级值|1、同一策略下，相同level_num，报错,2、level_num<0，level_num>9999，报错,3、非数值，如中文，奇怪符号|  
|
|  
|short_name/long_name|1、同一策略下，不同short_name/long_name,2、不同一策略下，相同short_name/long_name,3、字符类型：字母，字母带数值，字母带中文，中文带数值，带特殊符号（_），null，’‘，带双引号,4、短名称<=长名称，短名称>长名称，均不报错（与Oracle一致）,5、长度<=64,6、大小写,7、带双引号,8、procedure、function、表名|1、null，‘’,2、‘ ’（空串），与上面报错不一样,3、同一策略下，相同short_name/long_name，报错,4、字符类型：纯数值、其他特殊符号（空格、'null'、%1.2.3#!~()、，。。。），中文字符，报错,5、长度>64，报错,6、伪列：rowid、rowscn、rownum，报错,7、关键字：index，view，table，报错,8、不存在的策略，报错|  
|
|  
|一个策略下，最大支持9999个等级|1、一个策略，<=9999个等级|1、一个策略，>9999个等级，报错|相关用例：test_sdv_sr33680_lbac_yac_005|
|删除等级|入参个数|2|1，3|相关用例：test_sdv_sr33680_lbac_yac_004|
|  
|参数2类型、值|1、存在的等级值，可以直接数值，也可以数值字符串|1、不存在的策略、等级值，报错,2、使用长短名称,3、伪列：rowid、rowscn、rownum，报错,4、关键字：index，view，table，报错|1、规格差异：Oracle还支持通过短名称删除等级，yashandb暂不支持|
|  
|+label|1、策略未被label使用，可以删除成功|1、等级被label使用，删除失败，报错|  
|
|创建范围|入参个数|4|0~3，5|相关用例：test_sdv_sr33680_lbac_yac_006|
|  
|comp_num值|1、400，300，200（只是数值，不代表控制范围）,2、同一策略下，不同comp_num,3、不同一策略下，相同comp_num,4、边界值，0，9999,5、带小数点、二进制、数值字符的等级值|1、同一策略下，相同comp_num，报错,2、comp_num<0，comp_num>9999，报错,3、非数值，如中文，奇怪符号|  
|
|  
|short_name/long_name|1、同一策略下，不同short_name/long_name,2、不同一策略下，相同short_name/long_name,3、字符类型：字母，字母带数值，字母带中文，中文带数值，带特殊符号（_），null，’‘，带双引号,4、短名称<=长名称，短名称>长名称，均不报错（与Oracle一致）,5、长度<=64,6、大小写,7、带双引号,8、procedure、function、表名|1、null，‘’,2、‘ ’（空串），与上面报错不一样,3、同一策略下，相同short_name/long_name，报错,4、字符类型：纯数值、其他特殊符号（空格、'null'、%1.2.3#!~()、，。。。），中文字符，报错,5、长度>64，报错,6、伪列：rowid、rowscn、rownum，报错,7、关键字：index，view，table，报错,8、不存在的策略，报错,  
|  
|
|  
|一个策略下，最大支持9999个范围|1、一个策略，<=9999个范围|1、一个策略，>9999个范围，报错|相关用例：test_sdv_sr33680_lbac_yac_007|
|删除范围|入参个数|2|1，3|相关用例：test_sdv_sr33680_lbac_yac_006|
|  
|参数2类型、值|1、存在的范围值，可以直接数值，也可以数值字符串|1、不存在的策略、范围值，报错,2、使用长短名称,3、伪列：rowid、rowscn、rownum，报错,4、关键字：index，view，table，报错|1、规格差异：Oracle还支持通过短名称删除范围，yashandb暂不支持|
|  
|+label|1、策略未被label使用，可以删除成功|1、等级被label使用，删除失败，报错|  
|
|创建数据标签（label）|入参个数|3~4|0~2，5|相关用例：test_sdv_sr33680_lbac_yac_008|
|  
|参数1|存在的策略名|不存在的策略名|  
|
|  
|标签值（参数2）|1、相同策略下，不同标签值,2、不同策略下，相同标签值,3、边界值，0，99999999,4、带小数点、二进制、数值字符的标签值|1、相同策略下，相同标签值，报错,2、<0，>99999999，报错,3、非数值，如中文，奇怪符号|  
|
|  
|参数3（标签内容）（等级+范围）|1、相同策略下，不同标签内容,2、不同策略下，相同标签内容,3、等级与范围组合方式内容,- 同一组件类型的短名称以‘,’做间隔，不同组件类型的短名称以‘:’做间隔
- 大小写
|1、相同策略下，相同等标签内容，报错,2、等级与范围组合方式内容,- 同一组件类型用’:‘，不同组件用’,‘，报错
- 标签内容为level, compartment长名称，报错
- 不存在的等级，范围，报错
|  
|
|  
|参数4|1、true or false or 其他可以转为布尔的数值型 or 特殊字符型（  'true'、't'、 'yes'、 'y'、 'on'、 '1'、'false'、'f'、 'no'、 'n'、 'off'、 '0'  ）,2、存在该参数，true表示可以正常使用该标签作用到表的行上；false表示不可以正常使用该标签作用到表的行上；,不存在该参数（为空），默认true， 表示可以正常使用该标签作用到表的行上|其他值，报错||
|  
|短名称中带特殊符号(,和:)|/|/|相关用例：test_sdv_sr33680_lbac_yac_009|
|  
|标签内容大小边界值4000|<4000|>4000，报错1,=4000，报错2|/*标签内容长度最大4000,但是查看yls$lab表，发现ilabel字段也是最大4000字节，ilabel格式为：    
  策略id(20字节) + 组件类型（2字节）+level值字符串（4字节）+ ‘：’ + [comparment值得字符串 [, comparment值的字符串]] + ‘”’ + [group值得字符串 [, group值的字符串]]    
  所以 ilabel的字段长度已超过4000，所以报错*/|
|  
|等级值的必要性|1、创建数据标签值时，只带等级值；带等级值加范围值|1、创建数据标签值时，只带范围值，报错|  
|
|删除数据标签（label）|入参个数|2|1，3|相关用例：test_sdv_sr33680_lbac_yac_008|
|  
|参数2类型、值|1、存在的标签值，可以直接数值，也可以数值字符串|1、不存在的策略、标签值，报错,2、使用标签内容，报错,3、伪列：rowid、rowscn、rownum，报错,4、关键字：index，view，table，报错|1、规格差异：Oracle还支持通过标签内容删除范围，yashandb暂不支持|
|策略应用到表（apply_policy）|入参个数|3，4  ，5，6|0，1，2  ，7|  
|
|  
|入参类型、值|1、字符串，存在的策略，用户，表|1、非字符串，报错,2、不存在的策略、用户、表，报错,3、伪列：rowid、rowscn、rownum，报错,4、关键字：index，view，table，报错|  
|
|  
|关联策略个数|1、单表+单个策略,2、多表+单个策略,3、多表+多个策略|1、单表+多个策略，报错|相关用例：test_sdv_sr33680_lbac_yac_010|
|  
|table_options|1、  table_options不为  null：,（1）  READ_CONTROL,WRITE_CONTROL/  INSERT_CONTROL,/DELETE_CONTROL/UPDATE_CONTROL，单个或混合,2、  default_options不为null，table_options为  null，  使用策略上定义的default_options值,3、default_options  为null,   table_options  为null，  table_options会被设置为read_control+write_control,  
|1、LABEL_DEFAULT，HIDE，报错|  
|
|  
|同一个表被应用多个不同策略,同一个表被应用多个相同策略（重复应用）|  
|  
|  
|
|  
|重复应用|  
|  
|相关用例：test_sdv_sr33680_lbac_yac_011|
|  
|被应用策略的表前后是否有数据|  
|  
|相关用例：test_sdv_sr33680_lbac_yac_020|
|取消策略应用到表（remove_policy）|入参个数|3，4|0，1，2，5|相关用例：test_sdv_sr33680_lbac_yac_010|
|  
|入参类型、值（参数1~3）|1、字符串，存在的策略名，用户，表,  
|1、不存在的策略，用户，表，报错,2、非字符串，中文，复杂符号,3、伪列：rowid、rowscn、rownum，报错,4、关键字：index，view，table，报错|  
|
|  
|参数4|1、true or false or 其他可以转为布尔的数值型 or 特殊字符型（  'true'、't'、 'yes'、 'y'、 'on'、 '1'、'false'、'f'、 'no'、 'n'、 'off'、 '0'  ）,2、存在该参数，true表示可以  删除表中标签列  ；false表示不可以  删除表中标签列  ；,不存在该参数（为空），默认false， 表示不可以  删除表中标签列|其他值，报错|  
|
|  
|重复取消|  
|  
|相关用例：test_sdv_sr33680_lbac_yac_011|
|创建用户标签（user_label）|入参个数|3，4，5，6，7|0，1，2，8|相关用例：test_sdv_sr33680_lbac_yac_012,test_sdv_sr33680_lbac_yac_013|
|  
|参数1~3入参类型|1、字符串，存在的策略名，用户，等级，范围|1、不存在的策略，用户，等级，范围，报错,2、非字符串，中文，复杂符号,3、伪列：rowid、rowscn、rownum，报错,4、关键字：index，view，table，报错|  
|
|  
|max_read_label（参数3）|4~7参数为null|  
|  
|
|  
|max_write_label（参数4）|5~7参数为null|  
|相关用例：test_sdv_sr33680_lbac_yac_014|
|  
|min_write_label   （参数5）|6~7参数为null|  
|相关用例：test_sdv_sr33680_lbac_yac_015|
|  
|def_label（参数6）|7参数为null|  
|相关用例：test_sdv_sr33680_lbac_yac_016|
|  
|row_label（参数7）|  
|  
|相关用例：test_sdv_sr33680_lbac_yac_017|
|  
|以上参数混合使用|  
|  
|相关用例：test_sdv_sr33680_lbac_yac_018|
|  
|多次创建用户标签|用户关联多次执行，最终用户权限以最后一次执行为准|  
|相关用例：test_sdv_sr33680_lbac_yac_019|
|取消用户标签（user_label）|入参个数|2|0，1，3|相关用例：test_sdv_sr33680_lbac_yac_012|
|  
|参数1~2入参类型，入参值|1、字符串，存在的策略名，用户|1、不存在的策略，用户，报错,2、非字符串，中文，复杂符号，报错,3、伪列：rowid、rowscn、rownum，报错,4、关键字：index，view，table，报错|  
|
|对策略表进行dml操作|策略表|被应用策略的表不带索引，带标签列的表进行join计算   |  
|相关用例：test_sdv_sr33680_lbac_yac_021|
|  
|策略表+索引|被应用策略的表带索引，带标签列的表进行join计算   |  
|相关用例：test_sdv_sr33680_lbac_yac_022|
|  
|策略表+普通视图|根据被应用策略的表，创建普通视图|  
|相关用例：test_sdv_sr33680_lbac_yac_023|
|  
|策略表+物化视图|根据被应用策略的表，创建物化视图，  拦截报错|  
|  
|
|  
|策略表+普通表|带有lbac策略的表与普通表，交互使用|  
|相关用例：test_sdv_sr33680_lbac_yac_032|
|  
|  
|  
|  
|  
|
|缓存失效|执行SQL后，添加/删除策略|（1）打开lbac开关后，执行一轮LBAC操作，并查策略表（返回可访问数据）,（2）接着删除策略，查看POLICY_NAME 视图应为空，再次查策略表返回全部数据,（3）重新创建相同策略，再次执行一轮LBAC操作，除建表插入数据，查策略表，标签重新生效（返回可访问数据）|/|相关用例：test_sdv_sr33680_lbac_yac_025|
|  
|执行SQL后，添加/删除策略应用到表，添加/删除用户关联策略|（1）打开lbac开关后，执行一轮LBAC操作，并查策略表（返回可访问数据）,（2）对表移除策略（默认不删除表中标签列，除了参数4设置为true外），查看DBA_SA_TABLE_POLICIES视图应为空，，再次查策略表返回全部数据,（3）重新策略应用到表，查策略表，标签重新生效（返回可访问数据）|  
|相关用例：test_sdv_sr33680_lbac_yac_026|
|  
|  
|（1）删除用户标签，并查策略表返回空,（2）重新创建相同用户标签，查看策略表（返回可访问数据）|  
|  
|
|  
|执行SQL后，删除用户，查看用户关联相关表视图|1、创建用户标签后，查询策略表，返回可访问数据；删除不带表的用户u2，查看DBA_SA_USER_LABELS视图，不包含U2相关信息；重建用户u2，查询策略表返回空,2、创建用户标签后，删除带表的用户u1，查看DBA_SA_USER_LABELS视图，不包含U1相关信息；重新创建用户u1，表（与前面一样的数据），查看视图，新表上没有挂载任何策略|  
|相关用例：test_sdv_sr33680_lbac_yac_027|
|  
|执行SQL后，删除表，查看表关联相关表视图|1、策略应用到表后，查询策略表，返回可访问数据；删除策略表，再重新创建表，并插入相同数据，可查到所有值；对新表二次进行策略应用到表，查询策略表，返回可访问数据|  
|相关用例：test_sdv_sr33680_lbac_yac_028|
|LBAC不支持语法|除前面描述外，其他均不支持|/|1、ALTER_POLICY、DISABLE_POLICY、ENABLE_POLICY，报错,2、ALTER_LEVEL、 ALER_COMPARTMENT，报错,3、CREATE_GROUP、ALER_GROUP、ALTER_GROUP_PARENT、DROP_GROUP，报错,。。。。。。（没列全）|1、相关用例：test_sdv_sr33680_lbac_yac_029,2、不支持请看：    [YDBRD-19095: LBAC 详细设计 - YashanDB 文档 - SICS-CoD Confluence](https://conf.yasdb.com/pages/viewpage.action?pageId=135606670)  |
|用户+lbac_dba角色|LBACSYS用户（可以自己创建，可以被删除，无隐藏权限）+ lbac_dba角色|1、创建lbacsys用户，赋予dba+  lbac_dba角色，执行lbac相关操作|1、创建lbacsys用户后，不赋予任何权限，直接登录，报错,2、赋予create session，登录上lbacsys用户，执行lbac相关操作，会报错,3、赋予DBA，，登录上lbacsys用户，执行lbac相关操作，会报错|1、规格差异：Oracle LBAC管理员默认为LBACSYS用户,2、相关用例：test_sdv_sr33680_lbac_yac_030|
|LBAC+三权分立|LBAC+三权分立（sys用户下）|1、sys用户下，开启三权分立，一些权限会被限制，需要赋权后才能正常有权执行|/|相关用例：test_sdv_sr33680_lbac_yac_033|
|  
|LBAC+三权分立+  lbac_dba角色（非sys用户下）|1、创建dba普通用户+lbac角色，并开启三权分立，一些权限会被限制，需要赋权后才能正常有权执行|/|相关用例：test_sdv_sr33680_lbac_yac_034|
|LBAC相关表/视图|sys用户下，查看视图，系统表字段信息|LBAC开关,desc DBA_YLS_STATUS;    
  desc YLS$PROPS;|/|相关用例：test_sdv_sr33680_lbac_yac_035|
|  
|  
|LBAC策略,desc DBA_SA_POLICIES;    
  desc YLS$POL;|/|  
|
|  
|  
|LBAC等级,desc DBA_SA_LEVELS;    
  desc YLS$LEVELS;|/|  
|
|  
|  
|LBAC范围,desc DBA_SA_COMPARTMENTS;    
  desc YLS$COMPARTMENTS;|/|  
|
|  
|  
|LBAC标签,desc DBA_SA_LABELS;    
  desc YLS$LAB;|/|  
|
|  
|  
|LBAC策略表,desc DBA_SA_TABLE_POLICIES;    
  desc YLS$POLT;|/|  
|
|  
|  
|LBAC用户标签,desc DBA_SA_USER_LABELS;    
  desc YLS$USER_LABELS;|/|  
|
|  
|普通DBA用户，无法直接访问相关系统表（可通过scheme访问），但能访问视图|同上,desc DBA_YLS_STATUS;,desc sys.YLS$PROPS;|同上,desc YLS$PROPS;|  
|
|  
|普通DBA用户+LBAC_DBA权限，能访问相关系统表（带不带scheme均可）和视图|同上,desc DBA_YLS_STATUS;,desc YLS$PROPS;,desc sys.YLS$PROPS;|/|  
|
|LBAC+HA|查看LBAC操作，在主备上执行后，数据是否同步|1、主机上创建策略，等级等LBAC操作，备机上查看相关表和视图|1、备机上执行LBAC操作，报错|  
|
|  
|主备切换后，数据数据是否正常|1、新主备机上，通过表和视图查看前面执行LBAC操作产生的数据,2、新主机上创建策略，等级等LBAC操作，新备机上查看相关表和视图|1、新备机上执行LBAC操作，报错|  
|
|LBAC+seesion|session之间，lbac数据是否同步|session1: sql1 用到了强制访问控制，新开个session2 ：移除用户关联的策略，然后看session1 继续执行同样的sql1 ,查询结果发生变化|  
|  
|


集群专项测试：

|测试点|测试场景|有效类|无效类|备注|
|---|---|---|---|---|
|单个实例上测试LBAC开关|实例1和其他实例之间开关打开关闭同步|1、实例1上打开开关，实例2上查询DBA_YLS_STATUS显示开关打开（默认关闭）,2、实例1上打开开关，实例2上关闭，俩实例视图显示开关关闭,3、实例1上打开开关，实例2上打开；实例1上关闭开关，实例2上关闭|  
|相关用例：test_sdv_sr33680_lbac_yac_040|
|单个实例上进行LBAC操作|实例1和其他实例之间，进行LBAC操作后信息能同步|实例1上创建策略（等级/范围/数据标签/用户标签/策略应用到表）、删除策略（等级/范围/数据标签/用户标签/策略应用到表），  其余实例上也能同步信息|  
|缓存一致性测试,相关用例：test_sdv_sr33680_lbac_yac_041|
|多实例上进行LBAC操作|实例1和其他实例之间，进行同一操作|/|实例1上创建策略1，实例2上创建同名策略1，报错；,实例2上删除策略1，实例1上删除同名策略1，报错|相关用例：test_sdv_sr33680_lbac_yac_042|
|  
|  
|/|实例1上创建等级/范围/数据标签1，实例2上创建同名等级/范围/数据标签1，报错；,实例2上删除等级/范围/数据标签1，实例1上删除同名等级/范围/数据标签1，报错|  
|
|  
|  
|实例2上取消策略A应用到表A，实例1上取消策略A应用到表A|实例1上策略A应用到表A，实例2上策略A应用到表A，报错|  
|
|  
|  
|实例1上创建用户标签，实例2上创建同一用户标签；,实例2上删除用户标签，实例1上删除同一用户标签|/|  
|
|  
|实例1和其他实例之间，进行不同操作|实例1上创建策略1，实例2上创建策略2，查询视图2条数据；,实例2上删除策略1，实例1上删除略2，查询视图0条数据|/|相关用例：test_sdv_sr33680_lbac_yac_043|
|  
|  
|实例1上创建等级/范围/数据标签1，实例2上创建等级/范围/数据标签2，查询视图2条数据；,实例2上删除等级/范围/数据标签1，实例1上删除等级/范围/数据标签2，查询视图0条数据|/|  
|
|  
|  
|实例1上策略A应用到表A，实例2上策略A应用到表B，查询视图2条数据；,实例2上取消策略A应用到表A，实例1上取消策略A应用到表B，查询视图0条数据|实例1上策略A应用到表A，实例2上策略B应用到表A，报错,（一个表上只能挂一个策略）|  
|
|  
|  
|实例1上创建用户u1标签，实例2上创建用户u2标签，查询视图2条数据；,实例2上删除用户u1标签，实例1上删除用户u2标签，查询视图0条数据|/|  
|
|LBAC+DBLINK|考虑本地表和远端表为策略表/普通表，然后对两表进行查询|1、远端、本地均为策略表;,2、远端表为策略表，本地表为普通表;,3、本地表为普通表，远端表为标签表|  
|1、主要测试YashanDB→YashanDB,2、相关用例：test_sdv_sr33680_lbac_yac_037、test_sdv_sr33680_lbac_yac_038、test_sdv_sr33680_lbac_yac_039|
|  
|考虑本地表和远端表为策略表情况下，为这些表创建同义词，然后进行两表查询|1、远端、本地均为策略表+同义词;,2、远端表为策略表，本地表为普通表+同义词;,3、本地表为普通表，远端表为标签表+同义词|  
|  
|
|缓存失效|实例1的缓存失效动作有没有同步到其他实例|实例1执行 SQL 后，删除用户，关联删除，实例2查看相关表/视图；,实例1删除表，关联删除，实例2查看相关表/视图|  
|  
|
|并发测试|相同对象之间并发|多个实例，同时打开/关闭开关，创建/删除策略，组件，标签，应用/取消，各自并发|  
|  
|
|  
|不同对象之间并发|多个实例，同时打开/关闭开关，创建/删除策略，组件，标签，应用/取消，一起并发|  
|  
|
|  
|dml与LBAC操作并发（开关打开）|多个实例同时执行|  
|  
|
|  
|并发查询时，进行LBAC相关操作（开关打开）|多个实例同时执行|  
|查询语句包含执行时间较长的join算子|
|  
|查询和dml和关闭LBAC开关并发|多个实例同时执行|  
|  
|
|故障测试|kill进程|1、正在进行LBAC操作的实例故障,2、其他实例故障|  
|  
|
|  
|网络故障|实例间的私网故障,- down网卡
- 网络延迟
- 网络丢包
- 重复包
- 错包
- 网络闪断（ifup和ifdown间隔很短，不停地操作）
,*预期示例*  ：,网络故障前，实例1查lbac系统表A有10条数据；网络故障后，恢复网络，实例2查询lbac系统表A也有10条数据|  
|可参考测试用例：,  [cluster_dfr_test/src/test/cluster/network · master · CoD-X / Yastest Dfx · GitLab](https://git.yasdb.com/cod-x/yastest_dfx/-/tree/master/cluster_dfr_test/src/test/cluster/network)  ,![](https://pingcode.yasdb.com/atlas/files/public/673ab6d7ff43ee9c85b216a7/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBSUFBQUFBQUFBQ0JBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBUUFBQUFBQUJBQUFBQUFRQUFBQUFCQUFnQUFBQUFBQUFBQUFBQUFBQUFBQUFCQUFBRUFBQUFBQUFBQUFBQUFBQUFBQUFBQVFBQUFBQUlBQUFBQUFBUUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFJSUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTgzNjIsImV4cCI6MTc4MjQ2OTE2Mn0.v9wHXTdqOsCEwqjpgUJSEW4tT31_UOj8XBf5A3MdpeE)|
|  
|  
|共享存储的网络故障,- down网卡
- 网络延迟
- 网络丢包
- 重复包
- ~~错包（不建议测试，会把存储数据写坏）~~
- 网络闪断（ifup和ifdown间隔很短，不停地操作）
|  
|  
|
|  
|  
|主备间的通信网络故障,- replication_addr网络故障
|  
|  
|


2、性能测试（非测试重点）

|场景|SQL语句|数据量|LBAC关闭||LBAC打开||结论|
|---|---|---|:---:|---|:---:|---|---|
||||实例1|实例2|实例1|实例2|  
|
|select普通heap表|  
|10W条|  
|  
|  
|  
|  
|
|  
|  
|1G|  
|  
|  
|  
|  
|
|update普通heap表|  
|10W条|  
|  
|  
|  
|  
|
|  
|  
|1G|  
|  
|  
|  
|  
|
|select普通heap表的视图|  
|10W条|  
|  
|  
|  
|  
|
|  
|  
|1G|  
|  
|  
|  
|  
|


  


2）梳理该特性是否涉各个专项测试，并在详细设计中描述具体测试点

|专项|是否涉及|
|---|---|
|并发|是|
|长稳|是|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR/testkill|  
|
|HA|是|
|压力|  
|
|性能|是|
|可维护性|  
|


# 5.   **测试用例**

测试设计细化后的文本用例

详见附件

# 6.   **测试框架设计**

1. 沿用guider框架


# 7.   **测试环境说明**

|服务器类型|操作系统|服务器个数|部署节点|
|:---|:---|:---|:---|
|VM|CentOS Linux release 7.9.2009 (Core)|1|  
|


## Attachments:

[image2024-9-12_16-5-31.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczZDliYmU1OTNmOTljOWZmMjdjYTRmIiwicmVmX2lkIjoiNjczZDliYmU1OTNmOTljOWZmMjdjYTU5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU4MzYyLCJleHAiOjE3ODI1NDQ3NjJ9.WplW5qsDs3om5UHwcPLX5gbn4nu_xlnyjIlxMqMAkvU)

 (image/png)    


[image2024-9-13_10-58-13.png](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczZDliYmU1OTNmOTljOWZmMjdjYTUwIiwicmVmX2lkIjoiNjczZDliYmU1OTNmOTljOWZmMjdjYTU5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU4MzYyLCJleHAiOjE3ODI1NDQ3NjJ9.dpqctlLZeAx3rpfPLlgBARxBIfy2-Ccan3K_J9wsY6k)

 (image/png)    


[star_blue.svg](https://pingcode.yasdb.com/atlas/file/origin-url?version=undefined&action=download&token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiI5NmMxMDE1MTE0MjI0Y2E3OGY5YzViZmJkNjNjZDI1YiIsInRlYW1faWQiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJwZXJtaXNzaW9uIjoiMTExMTEiLCJmaWxlX2lkIjoiNjczZDliYmU1OTNmOTljOWZmMjdjYTUxIiwicmVmX2lkIjoiNjczZDliYmU1OTNmOTljOWZmMjdjYTU5IiwicmVmX3R5cGUiOiJwYWdlIiwiaWF0IjoxNzgyNDU4MzYyLCJleHAiOjE3ODI1NDQ3NjJ9.KqYvnl1O_0emDi6q_E3g5CHDdFhM3v5CyOHDo6RGmkI)

 (image/svg+xml)    


## Comments:

|  [](null)  ,1、集群故障通用测试    
       ---集群故障模式库（重点）（张志华）    
  2、性能保持和单机一样    
  3、迭代二,Posted by hanxiaopan at 十一月 11, 2024 15:57,,,--故障测试点之一,1、节点二故障时，在节点一上执行lbac操作（建），重新拉起节点二，查询lbac视图表等，,2、接着节点一故障，在节点二上执行lbac操作（删），重新拉起节点一，查询lbac视图表等,|
|---|


