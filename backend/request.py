class Request:
    def __init__(self, user_input):
        self.user_input = user_input

    def get_user_input(self):
        return self.user_input

    def set_user_input(self, user_input):
        self.user_input = user_input