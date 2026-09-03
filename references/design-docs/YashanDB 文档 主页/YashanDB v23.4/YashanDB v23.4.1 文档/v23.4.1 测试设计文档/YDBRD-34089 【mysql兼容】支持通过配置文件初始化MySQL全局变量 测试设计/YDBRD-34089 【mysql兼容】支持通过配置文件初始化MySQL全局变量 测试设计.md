Created by 党文琪, last modified on 十一月 15, 2024

# 1. 概述

  [https://pingcode.yasdb.com/pjm/items/670cdefce489dd0868f73846](https://pingcode.yasdb.com/pjm/items/670cdefce489dd0868f73846)    ?    
  #YDBRD-34089 【mysql兼容】支持通过配置文件初始化MySQL全局变量

# 2. 需求分析

## 2.1 功能点分析

- 1、MySQL参数持久化，使用参数文件记录mysql的全局变量值，实例启动的时候，把配置文件里的值作为默认值    
  2、OM安装数据库时，通过修改配置文件实现参数初始化


|  
|功能点|分析|  
|
|---|---|---|---|
|1|安装方式|yasboot安装（即om部署）|1、生成部署文件后修改部署文件，可选主备，主备配置可以不同,在  yashandb.toml配置文件中调整配置参数,[group.node.mysql_config]|
|2|  
|  
|2、执行安装|
|3|  
|  
|3、部署数据库|
|4|  
|  
|4、环境变量生效|
|5|  
|  
|5、检查安装结果,未执行开启mysql兼容时，参数不可查，也不会读my.ini,（中间可以有修改my.ini操作，评审时说不建议关注）,开启mysql兼容后，才读文件|
|6|  
|可视化安装|步骤6：设置配置参数中修改my.ini配置，确认页面上参数名正确，描述无异常，当前值可按照文档描述修改，值区域范围无误，默认值符合描述,执行安装后无异常|
|7|my.ini文件测试点|配置文件异常|配置文件中my.ini为空，[group.node.mysql_config]初始为空或在执行开启兼容前删除my.ini中的内容|
|8|  
|  
|参数名异常：拼写错误，大小写混合，无效的参数名，重复的参数设置（设置值不相同），参数名有引号|
|9|  
|  
|参数范围测试：结合参数具体分析取值合法与否对文件的影响，注意范围，null，其他非法值，参数单位|
|10|  
|  
|参数格式异常，有多个空格，不换行，有逗号或其他分隔符|
|11|  
|  
|未设置的参数按默认值生效|
|12|  
|  
|主备的my.ini文件配置不一致，发生切换后无异常|
|13|  
|  
|删除其中一个节点的文件，是否对其他节点有影响|
|14|  
|修改命令不同步到参数文件|修改配置后检查文件，文件中配置不变|


参数分类：

|  
|是否只读|是 只读|否 可以修改|
|---|---|---|---|
|1|实际支持|  
|autocommit,character_set_client,character_set_connection,character_set_results,init_connect,interactive_timeout,wait_timeout,max_allowed_packet,net_write_timeout,sql_mode,validate_password_check_user_name,validate_password_dictionary_file,validate_password_length,validate_password_mixed_case_count,validate_password_number_count,validate_password_policy,validate_password_special_char_count|
|2|语法兼容|datadir,license,lower_case_table_names,performance_schema,system_time_zone,version_comment,version,lower_case_file_system,  
|auto_increment_increment,character_set_server,collation_server,collation_connection,character_set_database,collation_database,time_zone,transaction_isolation,transaction_read_only,foreign_key_checks,net_buffer_length,net_read_timeout,query_cache_size,query_cache_type,sql_auto_is_null,sql_log_bin,sql_quote_show_create,sql_select_limit,tx_isolation,tx_read_only|


按照参数有效值分类，只读参数在下表中用红色标识，不支持在文件中设置且只读的参数用蓝色标识

|  
|类型|语法兼容参数|实际支持参数|
|---|---|---|---|
|1|int|auto_increment_increment,lower_case_table_names,max_allowed_packet,net_write_timeout,performance_schema,foreign_key_checks,net_buffer_length,net_read_timeout,query_cache_size,query_cache_type,sql_auto_is_null,sql_log_bin,sql_quote_show_create,sql_select_limit,tx_read_only|interactive_timeout,wait_timeout,validate_password_length,validate_password_mixed_case_count,validate_password_number_count,validate_password_policy,validate_password_special_char_count|
|2|boolean|transaction_read_only,lower_case_file_system|autocommit,validate_password_check_user_name|
|3|字符集文本|character_set_server,collation_server,collation_connection,character_set_database,collation_database|character_set_client,character_set_connection,character_set_results|
|4|varchar|license,datadir,system_time_zone,time_zone（会检查时间字符串是否合法）,transaction_isolation,version_comment,version,tx_isolation|init_connect,sql_mode（关注下变量特性与本次转测需求的结合）,validate_password_dictionary_file,  
|




第二次分析，按照实现类型区分剩余支持的参数，只检查支持在文件中写入的参数

|第二次调研|类型|变量名|mysql实现类型|是否调研|调研点|
|---|---|---|---|---|---|
|1|DTYPE_INTEGER|auto_increment_increment |Integer，1-65535|是,用例已看护|1,0,-3,65535.99,65534.99,65535|
|2||interactive_timeout |Integer,1-31536000|是,用例已看护|带单位s：报错,超范围：没报错？确认不对齐,![image.png](https://pingcode.yasdb.com/atlas/files/public/674d13e6a1ad9a3311de3b82/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBSUlBZ0FBQUFBQUFBQUFBQUFBQUFRZ0FBQUFFQUFBQUFBQUFBQWdCQUFBQUFBQWtCQUVCQUFDQUFnQUFBQUFBQUFBQUFBQUFBQUlJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVRZ1FBQUJBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTcyNTQsImV4cCI6MTc4MjQ2ODA1NH0.aIll3dckDXX5mLpAX-2CeGE2nAWxuETKj6fIYpO7YB4)|
|3||lower_case_table_names |Integer,0,1,2|是,用例已看护|true on：报错,超范围，比如3：报错|
|4||max_allowed_packet   （单独覆盖下，2的整数次方）|Integer,1024-1073741824，单位bytes,(<int32)|是,用例已看护|1024,1025,'test123',2147483648,1M|
|5||net_write_timeout |Integer,1-31536000|是,用例已看护,覆盖字符串，负数，0，超过上限值均报错,小数|表现类似  interactive_timeout |
|6||performance_schema |Boolean,|是,用例已看护|on true 1及其字符串形式都可,赋值2：查询0,![image.png](https://pingcode.yasdb.com/atlas/files/public/674d158ca1ad9a3311de3b84/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBSUlBZ0FBQUFBQUFBQUFBQUFBQUFRZ0FBQUFFQUFBQUFBQUFBQWdCQUFBQUFBQWtCQUVCQUFDQUFnQUFBQUFBQUFBQUFBQUFBQUlJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVRZ1FBQUJBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTcyNTQsImV4cCI6MTc4MjQ2ODA1NH0.aIll3dckDXX5mLpAX-2CeGE2nAWxuETKj6fIYpO7YB4)|
|7||wait_timeout |Integer,1-31536000|是,用例已看护,覆盖字符串，负数，0，超过上限值均报错,小数|原来赋值范围不对,![image.png](https://pingcode.yasdb.com/atlas/files/public/674d1839a1ad9a3311de3b87/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBSUlBZ0FBQUFBQUFBQUFBQUFBQUFRZ0FBQUFFQUFBQUFBQUFBQWdCQUFBQUFBQWtCQUVCQUFDQUFnQUFBQUFBQUFBQUFBQUFBQUlJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVRZ1FBQUJBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTcyNTQsImV4cCI6MTc4MjQ2ODA1NH0.aIll3dckDXX5mLpAX-2CeGE2nAWxuETKj6fIYpO7YB4),![image.png](https://pingcode.yasdb.com/atlas/files/public/674d184aa1ad9a3311de3b88/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBSUlBZ0FBQUFBQUFBQUFBQUFBQUFRZ0FBQUFFQUFBQUFBQUFBQWdCQUFBQUFBQWtCQUVCQUFDQUFnQUFBQUFBQUFBQUFBQUFBQUlJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVRZ1FBQUJBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTcyNTQsImV4cCI6MTc4MjQ2ODA1NH0.aIll3dckDXX5mLpAX-2CeGE2nAWxuETKj6fIYpO7YB4)|
|8||validate_password_length|Integer,0-validate_password_number_count+ validate_password_special_char_count+ (2 * validate_password_mixed_case_count)|是,用例已看护||
|9||validate_password_mixed_case_count|Integer，0-|是,用例已看护|字符串，超出上限报错,小数，负数都可以|
|10||validate_password_number_count|Integer，0-|是,用例已看护|字符串，超出上限报错,小数，负数都可以|
|11||validate_password_special_char_count|Integer，0-|是,用例已看护|字符串，超出上限报错,小数，负数都可以|
|12||net_buffer_length|Integer,1024-1048576，单位bytes,(<int32)|是,用例已看护|单位M类可以赋值成功,超长给的最长,![image.png](https://pingcode.yasdb.com/atlas/files/public/674d196ca1ad9a3311de3b8f/origin-url?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWRfZm9yX3B1YmljX2ltYWdlIjoiOTZjMTAxNTExNDIyNGNhNzhmOWM1YmZiZDYzY2QyNWIiLCJ0ZWFtX2Zvcl9wdWJsaWNfaW1hZ2UiOiI2NWQ2ZjRmZTZiM2U1NjI1MTZjZGU2YjciLCJibG9vbV9maWx0ZXIiOnsidHlwZSI6IkJsb29tRmlsdGVyIiwiX3NpemUiOjEwMjQsIl9uYkhhc2hlcyI6NSwiX2ZpbHRlciI6eyJzaXplIjoxMDI0LCJjb250ZW50IjoiQUFBQUFBQUFBQUFBQUFBQWdBQUFBQUFBQUFBQUFBQUFBSUlBZ0FBQUFBQUFBQUFBQUFBQUFRZ0FBQUFFQUFBQUFBQUFBQWdCQUFBQUFBQWtCQUVCQUFDQUFnQUFBQUFBQUFBQUFBQUFBQUlJQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUFBQUVRZ1FBQUJBQUFBQUFBQUFBQUFBQUFnQUFBQUFBQUFBQUFBQUFBPSJ9LCJfc2VlZCI6NzgxODc0OTM1MjB9LCJpYXQiOjE3ODI0NTcyNTQsImV4cCI6MTc4MjQ2ODA1NH0.aIll3dckDXX5mLpAX-2CeGE2nAWxuETKj6fIYpO7YB4)|
|13||net_read_timeout|Integer,1-31536000|是,用例已看护|类似  interactive_timeout ,|
|14||query_cache_size|Integer,0-18446744073709551615（64）/4294967295(32)单位bytes,(<uint64)|是,用例已看护|单位M类可以赋值成功,超长给的最长,上下边界值，负数时mysql修正为0，带单位配置，MB,KB,GB,TB,PB,EB|
|15|DTYPE_TINYINT|autocommit  (mysql:bool)|Boolean|是,用例已看护|true,12,test123,'off',0|
|16||transaction_read_only|Boolean|是,用例已看护|null,test123,high均报错，off成功|
|17||query_cache_type|Enumeration,012,on,off,demand|是,用例已看护|0，on,demand,2|
|18|DTYPE_VARCHAR|character_set_server |String|是,用例已看护|小数，非指定字符串，不支持,指定带双引号，单引号，支持|
|19||collation_server |String|是,用例已看护|null，true，非指定的字符串|
|20|| datadir（检查路径有效性）|Directory name|是,用例已看护|不存在的绝对路径,存在的相对路径都报错|
|21||init_connect |String|是,用例已看护|插入字符串大于max_allowed_packet，大于32000，关注下边界值|
|22||sql_mode |Set|是,用例已看护|赋值为小数，非特定字符串，带双引号的特性字符串|
|23||transaction_isolation |Enumeration(只能选特定值）|是,用例已看护|赋值为null，非指定字符串，一单一双引号，均报错,带单引号的指定字符串赋值成功|
|24|DTYPE_BOOL|validate_password_check_user_name|Boolean|是,用例已看护|赋值为null，mysql修正为0，此差异不对齐，赋值非boolean报错|
|25|DTYPE_CHAR|validate_password_dictionary_file|File name|是,用例已看护|赋值为超过255长度的字符，数字报错，False转为字符加载成功|
|26|DTYPE_SMALLINT|validate_password_policy|Enumeration,0/1/2/low/MEDIUM/STRONG|是,用例已看护|3，test7654，true报错,STRONG，1，成功|


## 2.2 应用场景

需要注意以下场景：

- 起库后，开启兼容前修改my.ini简单关注，因为后续开启兼容的流程会提前到建库时设置
- 关注重点是文件生效流程，按照参数类型区分覆盖
- 重点关注对外文档上有体现的部署方式，在新增文件后无异常


## 2.3 规格约束

- 目前暂时不支持将修改后的变量写入文件，也不支持通过om命令修改变量值。


# 3. 详细测试设计

## 3.1 测试设计方法

测试设计主要采用等价类方法对测试场景做区分，测试重点在yasboot方式部署上，参数按照类型分类交叉覆盖

## 3.2 详细测试设计

|  
|1级测试点|2级测试点|3级测试点|覆盖参数|
|---|---|---|---|---|
|1|单机部署|不修改  yashandb.toml，直接起库后，开启兼容|检查参数按默认值生效|  
|
|2|  
|修改  yashandb.toml，修改只读参数|设置符合定值|datadir|
|3|  
|  
|设置非定值|performance_schema|
|4|  
|修改  yashandb.toml，设置可修改参数，设置符合定值|覆盖所有支持在文件中设置的参数|  
|
|5|  
|  
|不支持在文件中设置的参数|system_time_zone|
|6|  
|  
|  
|version_comment|
|7|  
|  
|  
|version|
|8|  
|  
|  
|license|
|9|  
|  
|  
|lower_case_file_system|
|||||character_set_client ,character_set_connection ,character_set_results ,collation_connection ,character_set_database,collation_database,foreign_key_checks,sql_auto_is_null,sql_log_bin,sql_quote_show_create,sql_select_limit,tx_isolation,tx_read_only,time_zone|
|10|  
|修改  yashandb.toml，设置可修改参数，设置不符合定值|参数名拼写错误|wait_timeout|
|11|  
|  
|大小写混合（预计转为大写，不影响读取）|character_set_database|
|12|  
|  
|重复的参数设置（设置值不相同），预计后设置的生效|validate_password_length|
|13|  
|  
|无效的参数名，参数为yasdb.ini中支持的非mysql兼容参数|  
|
|14|  
|  
|参数名有引号，参数值有引号|max_allowed_packet|
|15|  
|  
|参数范围测试，入参是int，超出范围，null|interactive_timeout|
|16|  
|  
|参数范围测试，入参是boolean，非法值，null|transaction_read_only|
|17|  
|  
|参数范围测试，入参是字符集文本，非指定字符串，null|character_set_client|
|18|  
|  
|参数范围测试，入参是字符串，不合法事件类型字符串|time_zone|
|19|  
|  
|参数格式异常，有多个参数时，用逗号分隔，不换行|auto_increment_increment,validate_password_check_user_name|
||||参数单位有异常时，能否正常读取（预计报错）|max_allowed_packet|
||||起库后，修改参数配置，不同步到文件中，另起session查询，仍为原值|net_read_timeout,validate_password_length,character_set_client,sql_mode|
|20|  
|异常测试|安装后，开启mysql兼容之前，删除my.ini文件，开启兼容后检查参数值为默认值而非设定值,（此场景涉及的流程后续有计划更改，仅简单拦截）|validate_password_policy,character_set_client|
|21|  
|  
|安装后，开启mysql兼容之前，修改my.ini文件中的参数配置，开启兼容后按照文件中最新配置生效|validate_password_policy,character_set_client|
|22|  
|  
|开启mysql兼容状态下，修改文件新增参数，检查参数值，重启后，重新开启兼容，再检查参数值|net_read_timeout,validate_password_length,character_set_client|
|23|  
|  
|开启mysql兼容状态下，删除my.ini文件，检查参数值，重启后，重新开启兼容，再检查参数值|validate_password_number_count,character_set_results|
|24|  
|  
|有部分支持写在文件中的参数，部分不支持，开启mysql兼容后报错，检查数据库是否能进入mysql兼容模式,预计报错时，修改my.ini文件，重新开启兼容，删除不支持参数，才能成功|validate_password_number_count,validate_password_policy,performance_schema,lower_case_file_system|
|25|  
|  
|开启mysql兼容后，修改my.ini，修改内容合法（修改参数值），检查参数，不立即生效，重新开启兼容后再检查|interactive_timeout,transaction_read_only,sql_mode|
|26|  
|  
|开启mysql兼容后，修改my.ini，修改有不支持写入的参数，检查参数及数据库，不立即生效，重新开启兼容后再检查，影响开启兼容，删除内容后重新开启|wait_timeout,max_allowed_packet,lower_case_table_names,system_time_zone|
|27|  
|  
|开启mysql兼容后，修改my.ini文件内容异常（参数值不合法），检查参数及数据库，不立即生效，重新开启兼容后再检查，影响开启兼容，删除内容后重新开启|validate_password_length,net_write_timeout|
|28|  
|  
|无my.ini，起库后，新增my.ini，开启兼容检查文件中配置是否生效|validate_password_mixed_case_count,query_cache_size|
|29|  
|  
|无my.ini，起库后，开启兼容，新增my.ini，检查配置是否生效|validate_password_number_count,net_read_timeout|
|30|  
|  
|有不支持写入的参数时，反复执行alter触发失败，检查数据库是否异常（预计会有问题，但是后续兼容流程修改就不涉及，此测试场景是否保留？）,保留作为看护用例，流程修改后再放开上库|validate_password_policy,autocommit,sql_mode,version_comment|
|31|  
|修改不生效|开启兼容，set   global   ，检查文件中不记录，关闭mysql兼容再打开，仍按文件中或默认值生效|  
|
|32|  
|  
|开启兼容，set   session  ，检查文件中不记录，关闭mysql兼容再打开，仍按文件中或默认值生效|  
|
|33|主备部署|主备参数配置一致|起库后开启兼容，主备机查询无异常|interactive_timeout,autocommit,query_cache_size,collation_connection|
|34|  
|主备参数配置不一致|起库后开启兼容，主备机查询无异常，主备切换后，新主机配置生效，无异常|character_set_connection,character_set_results,tx_read_only,validate_password_special_char_count|
|35|可视化部署（本次不交付，预计单独提需求）|可配置参数符合文档描述|  
|  
|
|36|  
|参数范围符合文档描述|  
|  
|
|37|  
|参数描述符合文档描述|  
|  
|
|38|  
|默认值符合文档描述|  
|  
|
|39|  
|可选值符合文档描述|  
|  
|
|40|  
|以上配置完成后建库无异常，建库后开启兼容，查询参数值符合预期|  
|  
|




评审意见：

1、可视化部署本次转测暂不包括

2、覆盖参数再按照类型精简下

3、  sql_mode（关注下变量特性与本次转测需求的结合）

4、有不合法参数的情况下，反复alter的场景保留，但等流程修改后再放开上库  


|系统级DFX分类|是否涉及|
|:---|:---|
|CT|  
|
|KT|  
|
|长稳|  
|
|一致性|  
|
|三方测试工具    
  (sqltest，sqlancer)|  
|
|安全|  
|
|DFR|  
|
|HA|  
|
|压力|  
|
|性能|  
|
|可维护性|  
|


  


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



