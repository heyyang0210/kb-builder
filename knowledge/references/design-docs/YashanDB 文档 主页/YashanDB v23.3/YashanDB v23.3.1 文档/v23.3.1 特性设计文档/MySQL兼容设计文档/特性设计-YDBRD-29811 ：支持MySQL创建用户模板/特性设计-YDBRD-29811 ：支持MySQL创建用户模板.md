Created by 史鑫, last modified on 八月 28, 2024

  [https://pingcode.yasdb.com/pjm/items/667bd670288e197820af391e](https://pingcode.yasdb.com/pjm/items/667bd670288e197820af391e)    ?    
  #YDBRD-29811 【mysql兼容】支持MySQL创建用户模板

#   [1. 总述](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#1-%E6%80%BB%E8%BF%B0)  

此需求主要是做密码的复杂度校验。密码的输入可以是：

- create user 'XXX'@'ip' identified by 'XXX';
- alter user 'XXX'@'ip' identified by 'XXX';


#   [2. ](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#4-%E7%89%B9%E6%80%A7)    功能列表

### 复杂度校验规则/  复杂度校验的全局变量：

- 生效范围：
    - 动态参数，立即生效
    - **持久化**  ：以下参数都不持久化（mysql：  SET   PERSIST  ），都是内存值。  **如果支持持久化参数，后续yashan可增加mysql.ini进行持久化参数**
- **SET**
    - **值合法性检验**
    - **不支持session级别的修改**
- **检查方式：完全按照set的值进行检查。如下所示**


|变量名字|默认值|意义|合法性校验|
|:---|:---|:---|:---|
|validate_password_check_user_name|ON|设置为ON的时候表示   不能  将密码设置成当前用户名。|on/off|
|validate_password_dictionary_file|空|用于检查密码的字典文件的路径名，默认为空|- 长度：按照我们的路径长即可。
- load：每次set时，重新读文件，解析文件。
- 作为黑名单
|
|validate_password_length|8|密码的最小长度，也就是说密码长度必须大于或等于8|不报错，不符合要求则内部关联参数自行调整，规则：,validate_password.number_count + validate_password.special_char_count + (2 * validate_password.mixed_case_count)|
|validate_password_mixed_case_count|1|如果密码策略是中等或更强的，validate_password要求密码具有的小写和大写字符的最小数量。对于给定的这个值密码必须有那么多小写字符和那么多大写字符。|必须是int|
|validate_password_number_count|1|密码必须包含的数字个数|必须是int|
|validate_password_policy|MEDIUM|密码强度检验等级，可以使用数值0、1、2或相应的符号值LOW、MEDIUM、STRONG来指定。0/LOW：只检查长度。1/MEDIUM：检查长度、数字、大小写、特殊字符。2/STRONG：检查长度、数字、大小写、特殊字符、字典文件。,yashan,- 0/LOW：只检查长度。
- 1/MEDIUM：检查长度、数字、大小写、特殊字符、用户名。
- 2/STRONG：检查长度、数字、大小写、特殊字符、用户名。
|0，1，2|
|validate_password_special_char_count|1|密码必须包含的特殊字符个数|必须是int|


##   [MySQL :: MySQL 8.4 Reference Manual :: 8.4.3.2 Password Validation Options and Variables](https://dev.mysql.com/doc/refman/8.4/en/validate-password-options-variables.html)  

## 全局变量的查询展示

  


##   [3.规格与约束](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#3-%E8%A7%84%E6%A0%BC%E4%B8%8E%E7%BA%A6%E6%9D%9F)  

- 仅在mysql兼容模式做检查
- ### 支持设置参数。参数非法后自行更正/参数联动的规则见参  **数联动/校验**
- username长度上限64，且要大于0
- 密码上限64（跟yashan一致），且要大于0。（  **mysql可以为0，但是yashan不允许，安全性极低，且会引入其他问题**  ）此校验的优先级最高，如果64和  validate_password_length有冲突，则永远校验不成功
- 密码非法字符按照string本身的规则，自身不做校验限制
- 用户名非法字符按照string/name本身的规则，自身不做校验限制
- 这些参数都是全局的，session级别查询可查，需要全局变量需求统一改，不在此做更改。
- 当设置完全局变量后，都严格按照全局变量本身校验，不再做其他复杂的兼容。
- validate_password_check_user_name校验的是登录用session的schema名，不是DDL的目标用户。正向/反向（无字符集属性的二进制流的反向）相同（不是子串）就报错。
- validate_password_special_char_count只要不是字母（a-z/A-Z）/数字(0-9)，都认为是特殊字符。（跟yashan本身一致）


#   [4. 特性](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#4-%E7%89%B9%E6%80%A7)  

创建/更改用户密码，支持密码强度校验，不支持指定密码策略的默认值。

**mysql源码的变量类型：**

|name|  
|类型|
|:---|:---|:---|
|validate_password_check_user_name|  
|bool|
|validate_password_dictionary_file|static MYSQL_SYSVAR_STR(dictionary_file, validate_password_dictionary_file,    
  PLUGIN_VAR_RQCMDARG | PLUGIN_VAR_MEMALLOC,    
  "password_validate_dictionary file to be loaded and check for password",    
  NULL, dictionary_update, NULL);|string|
|validate_password_length|static MYSQL_SYSVAR_INT(length, validate_password_length,    
  PLUGIN_VAR_RQCMDARG,    
  "Password validate length to check for minimum password_length",    
  NULL, length_update, 8, 0, 0, 0);|int|
|validate_password_mixed_case_count|static MYSQL_SYSVAR_INT(mixed_case_count, validate_password_mixed_case_count,    
  PLUGIN_VAR_RQCMDARG,    
  "Password validate mixed case to ensure minimum upper/lower case in password",    
  NULL, length_update, 1, 0, 0, 0);|int|
|validate_password_number_count|static MYSQL_SYSVAR_INT(number_count, validate_password_number_count,    
  PLUGIN_VAR_RQCMDARG,    
  "password validate digit to ensure minimum numeric character in password",    
  NULL, length_update, 1, 0, 0, 0);|int|
|validate_password_policy|static MYSQL_SYSVAR_ENUM(policy, validate_password_policy,    
  PLUGIN_VAR_RQCMDARG,    
  "password_validate_policy choosen policy to validate password"    
  "possible values are LOW MEDIUM (default), STRONG",    
  NULL, NULL, PASSWORD_POLICY_MEDIUM, &password_policy_typelib_t);|enum|
|validate_password_special_char_count|static MYSQL_SYSVAR_INT(special_char_count,    
  validate_password_special_char_count, PLUGIN_VAR_RQCMDARG,    
  "password validate special to ensure minimum special character in password",    
  NULL, length_update, 1, 0, 0, 0);|int|


### 参数联动/校验

- 联动：整体规则，validate_password_length>=  validate_password_number_count   + validate_password_special_char_count + (2 * validate_password_mixed_case_count)，不符合则自行更改
    - validate_password_length（int)：  validate_password_number_count   + validate_password_special_char_count + (2 * validate_password_mixed_case_count)
        - 当 validate_password_length 计算的结果超出int上限，则不调整validate_password_length
        - 不超上限，如果validate_password_length <  validate_password_mixed_case_count  /validate_password_number_count/validate_password_special_char_count 的值计算出来，更新validate_password_length = validate_password_mixed_case_count/validate_password_number_count/validate_password_special_char_count
    - validate_password_length本身设置如果 <  validate_password_mixed_case_count/validate_password_number_count/validate_password_special_char_count ，则=validate_password_number_count + validate_password_special_char_count + (2 * validate_password_mixed_case_count)
- validate_password_length/validate_password_mixed_case_count/validate_password_number_count/validate_password_special_char_count
    - 报错：超int64范围，报错
    - 内部调整：
        - 上限：> int32上限（2147483647），则调整为：2147483647
        - 下限：<0 , 取0
- validate_password_check_user_name：bool本身的规则
    - 数字：非0则1
    - 字符：“on”/“true”/"yes"/"off"/“0”
    - true/false


以上参数，实际检查都会用到，需要校验。

- validate_password_dictionary_file：没有用到，不校验


  


# 5.兼容性

无

#   [6.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#5%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

无

#   [7.未来规划](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#5%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)  

无

#   [8.](https://conf.yasdb.com/pages/viewpage.action?pageId=138545264#5%E6%9C%AA%E6%9D%A5%E8%A7%84%E5%88%92)    自测用例

   电子表格

