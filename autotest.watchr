# Call from command line with `watchr autotest.watchr`

# Automatically run tests when files change.
# I run this in the corner of my screen to let me know immediately
# if I make breaking changes (or syntax errors).

# It depends on ruby and the watchr gem - 
# get it with `sudo gem install watchr`

# Idea from http://cjohansen.no/en/node_js/unit_testing_node_js_apps

def run_all_tests
  print `clear`
  puts "Tests run #{Time.now.strftime('%Y-%m-%d %H:%M:%S')}"
  puts `node runtests.js`
end

run_all_tests
watch("(tests|lib)(/.*)+.js") { |m| run_all_tests }
